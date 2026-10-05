package org.busondan.busondan.service;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.busondan.busondan.dto.SubwayArrivalDto;
import org.busondan.busondan.dto.SubwayScheduleDto;
import org.busondan.busondan.dto.SubwayTimeTableDto;
import org.busondan.busondan.dto.SubwayArrivalDto.SubwayArrivalInfo;
import org.busondan.busondan.entity.SubwayTimedelta;
import org.busondan.busondan.entity.SubwayTimetable;
import org.busondan.busondan.repository.SubwayTimedeltaRepository;
import org.busondan.busondan.repository.SubwayTimetableRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class SubwayDataService {

    @Value("${subway.api.key}")
    private String apiKey;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;

    private final SubwayTimedeltaRepository subwayTimedeltaRepository;
    private final SubwayTimetableRepository subwayTimetableRepository;
    private final String stationKey = "1075075233";
    private final String lineKey = "1075";

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    private class SubwayLogs {
        private String trainNo;
        private String CurrentStation;
        private String arvlCode;
        private LocalTime logTime;
        private Long remainingTime;
    }

    Map<String, SubwayLogs> recentSubwayLogs = new HashMap<>();

    @Scheduled(fixedRate = 70_000)
    public void fetchSubwayData() {
        LocalDateTime systemNow = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
        final LocalDateTime now = (systemNow.getHour() < 3) 
                                ? systemNow.minusDays(1) 
                                : systemNow;
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        if (now.getHour() > 1 && now.getHour() < 5) {
            log.debug("Skipping subway data fetch between 1 AM and 5 AM");
            recentSubwayLogs.clear();
            return;
        }
        if ("YOUR_API_KEY".equals(apiKey)) {
            log.warn("Subway API key is not set. Please configure the api.key property.");
            return;
        }
        log.debug("Fetching subway data...");
        String Line = "수인분당선";
        String encodedLine = URLEncoder.encode(Line, StandardCharsets.UTF_8);
        String url = String.format("http://swopenapi.seoul.go.kr/api/subway/%s/json/realtimePosition/1/100/%s",
                apiKey, encodedLine);
        URI uri = URI.create(url);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0");
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.GET, entity, String.class);
            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode arrivalList = root.path("realtimePositionList");
            // 상행 선 하행 선 각각 리스트
            List<SubwayArrivalDto.SubwayArrivalInfo> processedListUpLine = new ArrayList<>();
            List<SubwayArrivalDto.SubwayArrivalInfo> processedListDownLine = new ArrayList<>();

            // 요일 별 평일 / 휴일 구분
            String todayType = (java.time.LocalDate.now().getDayOfWeek().getValue() >= 6) ? "휴일" : "평일";
            if (arrivalList != null && arrivalList.isArray()) {
                for (JsonNode arrival : arrivalList) {
                    log.debug("Processing arrival data: {}", arrival.toString());
                    String updnLine = Long.parseLong(arrival.path("updnLine").asText()) == 0 ? "상행" : "하행"; // 0: 상행, 1:
                                                                                                            // 하행
                    String trainNo = String.format("K%s", arrival.path("trainNo").asText()); // trainNo 앞에 K 추가
                    String currentStation = arrival.path("statnNm").asText(); // 현재 역 이름
                    String lastTrain = arrival.path("lstcarAt").asText(); // 막차 여부
                    String arvlCode = arrival.path("trainSttus").asText(); // 도착 코드 (0: 진입, 1: 도착, 2: 출발, 3: 전역출발)
                    String endStationName = arrival.path("statnTnm").asText(); // 종착역 이름

                    LocalTime reqTime = LocalTime.parse(arrival.path("recptnDt").asText(), formatter); // 데이터 수신
                                                                                                       // 시간

                    // 중복 데이터 처리
                    if (recentSubwayLogs.get(trainNo) != null) {
                        // 해당 열차의 마지막 로그
                        SubwayLogs lastLog = recentSubwayLogs.get(trainNo);

                        // 현재 역과 도착 코드가 동일한 경우 중복으로 간주
                        if (lastLog.getCurrentStation().equals(currentStation)
                                && lastLog.getArvlCode().equals(arvlCode)) {
                            log.debug("Skipping duplicate log for TrainNo: {} at Station: {}", trainNo, currentStation);
                            // 남은 시간 업데이트
                            Duration diff = Duration.between(recentSubwayLogs.get(trainNo).getLogTime(), now);
                            String remainingTime = recentSubwayLogs.get(trainNo).getRemainingTime()
                                    - diff.toMinutes() < 0 ? "0"
                                            : Long.toString(recentSubwayLogs.get(trainNo).getRemainingTime()
                                                    - diff.toMinutes());
                            // 이미 처리된 리스트에 업데이트
                            if (updnLine.equals("상행")) {
                                processedListUpLine.add(new SubwayArrivalInfo(updnLine,
                                        endStationName,
                                        "",
                                        trainNo,
                                        currentStation,
                                        remainingTime,
                                        "1".equals(lastTrain) ? true : false,
                                        Integer.parseInt(arvlCode),
                                        "live"));
                            } else {
                                processedListDownLine.add(new SubwayArrivalInfo(updnLine,
                                        endStationName,
                                        "",
                                        trainNo,
                                        currentStation,
                                        remainingTime,
                                        "1".equals(lastTrain) ? true : false,
                                        Integer.parseInt(arvlCode),
                                        "live"));
                            }
                            continue;
                        }
                    }
                    SubwayTimedelta timedelta;
                    // 출발 코드일 경우 출발 기준 시간차 조회, 그 외는 도착 기준 시간차 조회
                    if (arvlCode.equals("2") || arvlCode.equals("3")) {
                        log.debug("Skipping TrainNo: {} at Station: {} due to arrival code: {}", trainNo,
                                currentStation,
                                arvlCode);
                        timedelta = subwayTimedeltaRepository
                                .findByUpdnLineAndDeltaAndStationName(updnLine, "출발", currentStation).orElse(null);
                    } else {
                        timedelta = subwayTimedeltaRepository
                                .findByUpdnLineAndDeltaAndStationName(updnLine, "도착", currentStation).orElse(null);
                    }
                    // 죽전역 기준 TimeDelta 조회
                    SubwayTimedelta targettimedelta = subwayTimedeltaRepository
                            .findByUpdnLineAndDeltaAndStationName(updnLine, "도착", "죽전").orElse(null);
                    SubwayTimedelta endStationTimedelta = subwayTimedeltaRepository
                            .findByUpdnLineAndDeltaAndStationName(updnLine, "도착", endStationName).orElse(null);

                    // 중간에 종착되는 기차의 경우 제외
                    if (endStationTimedelta != null) {
                        log.debug("End station timedelta not found for station: {}", endStationName);
                        continue;
                    }
                    Long delta;
                    // 남은 시간 계산 예외 처리 (존재하지 않은 경우 혹은 죽전역일 경우 매우 큰 값 부여)
                    if (timedelta == null || targettimedelta == null
                            || (currentStation.equals("죽전"))) {
                        // 막차인 경우 지나간 것을 유지할 이유가 없음
                        if (lastTrain.equals("1")) {
                            log.debug("Skipping last train TrainNo: {} at Station: {}", trainNo, currentStation);
                            continue;
                        }
                        // 지나간 기차에 대해 유지하여 시간표 중복 노출을 방지
                        delta = 99999999L;
                    } else { // 남은 시간 계산
                        Duration diff = Duration.between(reqTime, now.toLocalTime()); // 현재 시간과 데이터 수신 시간 차이 보정
                        delta = targettimedelta.getTimedelta() - timedelta.getTimedelta() - diff.getSeconds();
                    }
                    // 음수일 경우 (수신 시간 차이 보정 과정에서) 0으로 처리
                    if (delta < 0) {
                        delta = 0L;
                    }
                    // 최근 로그 업데이트
                    recentSubwayLogs.put(trainNo,
                            new SubwayLogs(trainNo, currentStation, arvlCode, reqTime, delta / 60));
                    SubwayArrivalDto.SubwayArrivalInfo dto = new SubwayArrivalDto.SubwayArrivalInfo(
                            updnLine,
                            endStationName,
                            "",
                            trainNo,
                            currentStation,
                            Long.toString(delta / 60),
                            "1".equals(lastTrain) ? true : false,
                            Integer.parseInt(arvlCode),
                            "live");
                    if (updnLine.equals("상행")) {
                        processedListUpLine.add(dto);
                    } else {
                        processedListDownLine.add(dto);
                    }
                }
            }

            LocalTime baseTime = null;
            if (now.getHour() >= 0 && now.getHour() < 3) {
                baseTime = LocalTime.of(23, 00, 00);
            } else {
                baseTime = now.toLocalTime().minusHours(1);
            }

            // 상행 시간표 데이터 추출
            List<SubwayTimetable> upLineTimetables = subwayTimetableRepository
                    .findTimetableUsingDynamicDayCount(baseTime, todayType, "상행");
            
            log.debug("********{} {}", baseTime.toString(), todayType);
            // 시간표 데이터 및 실시간 데이터 통합 작업 (상행)
            upLineTimetables.forEach(time -> {
                boolean found = false;
                // 이미 실시간 데이터에 존재하는지 확인
                for (SubwayArrivalDto.SubwayArrivalInfo info : processedListUpLine) {
                    // 열차 번호가 동일하면 출발역명 업데이트 후 종료
                    if (info.getTrainNo().equals(time.getTrainNo())) {
                        info.setStartStationName(time.getFirstStation());
                        found = true;
                        break;
                    }
                }
                // 실시간 데이터에 없는 경우 시간표 기준 데이터로 추가
                if (!found && !time.getLastStation().equals("죽전")) {
                    LocalTime arrivalTime = time.getArrivalTime(); // 도착 예정 시간
                    LocalDateTime arrivalDateTime = LocalDateTime.of(now.toLocalDate(), arrivalTime);

                    // 새벽 시간 처리
                    if (arrivalDateTime.getHour() >= 0 && arrivalDateTime.getHour() < 3 && now.getHour() >= 23) {
                        log.debug("Adjusting arrivalDateTime for early morning arrival");
                        arrivalDateTime = arrivalDateTime.plusDays(1);
                    } else if (now.getHour() >= 0 && now.getHour() < 3 && arrivalDateTime.getHour() >= 23) {
                        log.debug("Adjusting arrivalDateTime for late night arrival");
                        arrivalDateTime = arrivalDateTime.minusDays(1);
                    }
                    // 남은 시간 계산
                    Duration diff = Duration.between(now, arrivalDateTime);
                    // 음수일 경우 제외
                    if (!diff.isNegative()) {
                        SubwayArrivalDto.SubwayArrivalInfo dto = new SubwayArrivalDto.SubwayArrivalInfo(
                                "상행",
                                time.getLastStation(),
                                time.getFirstStation(),
                                time.getTrainNo(),
                                "시간표 기준",
                                Long.toString(diff.toMinutes()),
                                time.getLastTrain(),
                                -1,
                                "timetable");
                        processedListUpLine.add(dto);
                    }
                }

            });

            // 하행 시간표 데이터 추출
            List<SubwayTimetable> downLineTimetables = subwayTimetableRepository
                    .findTimetableUsingDynamicDayCount(baseTime, todayType, "하행");
            // 시간표 데이터 및 실시간 데이터 통합 작업 (하행)
            downLineTimetables.forEach(time -> {
                boolean found = false;
                // 이미 실시간 데이터에 존재하는지 확인
                for (SubwayArrivalDto.SubwayArrivalInfo info : processedListDownLine) {
                    // 열차 번호가 동일하면 출발역명 업데이트 후 종료
                    if (info.getTrainNo().equals(time.getTrainNo())) {
                        info.setStartStationName(time.getFirstStation());
                        found = true;
                        break;
                    }
                }
                if (!found && !time.getLastStation().equals("죽전")) {
                    LocalTime arrivalTime = time.getArrivalTime(); // 도착 예정 시간
                    LocalDateTime arrivalDateTime = LocalDateTime.of(now.toLocalDate(), arrivalTime);
                    
                    // 새벽 시간 처리
                    if (arrivalDateTime.getHour() >= 0 && arrivalDateTime.getHour() < 3 && now.getHour() >= 23) {
                        log.debug("Adjusting arrivalDateTime for early morning arrival");
                        arrivalDateTime = arrivalDateTime.plusDays(1);
                    } else if (now.getHour() >= 0 && now.getHour() < 3 && arrivalDateTime.getHour() >= 23) {
                        log.debug("Adjusting arrivalDateTime for late night arrival");
                        arrivalDateTime = arrivalDateTime.minusDays(1);
                    }
                    Duration diff = Duration.between(now, arrivalDateTime); // 남은 시간 계산
                    // 음수일 경우 제외
                    if (!diff.isNegative()) {
                        SubwayArrivalDto.SubwayArrivalInfo dto = new SubwayArrivalDto.SubwayArrivalInfo(
                                "하행",
                                time.getLastStation(),
                                time.getFirstStation(),
                                time.getTrainNo(),
                                "시간표 기준",
                                Long.toString(diff.toMinutes()),
                                time.getLastTrain(),
                                -1,
                                "timetable");
                        processedListDownLine.add(dto);
                    }
                }
            });

            processedListUpLine.removeIf(info -> Long.valueOf(info.getRemainingTime()) >= 999999L);
            processedListDownLine.removeIf(info -> Long.valueOf(info.getRemainingTime()) >= 999999L);
            // 남은 시간 기준 정렬
            processedListUpLine.sort(
                    (a, b) -> Integer.valueOf(a.getRemainingTime())
                            .compareTo(Integer.valueOf(b.getRemainingTime())));
            processedListDownLine.sort(
                    (a, b) -> Integer.valueOf(a.getRemainingTime())
                            .compareTo(Integer.valueOf(b.getRemainingTime())));

            // 저장 형식에 맞게 변환 후 Redis 저장
            Map<String, SubwayArrivalDto> result = new HashMap<>();
            result.put("up", new SubwayArrivalDto("상행",
                    processedListUpLine));
            result.put("down", new SubwayArrivalDto("하행",
                    processedListDownLine));
            String redisValue = objectMapper.writeValueAsString(result);
            redisTemplate.opsForValue().set("subway_data", redisValue, Duration.ofSeconds(500));
            log.debug("✅ (Redis) Updated Subway Data for 죽전");
        } catch (RestClientException | JsonProcessingException e) {
            log.error("❌ (Redis) Error for Subway : {}", e.getMessage());
        }
    }

    @Scheduled(fixedRate = 5_000)
    public void updateSubwayInfo() {
        Map<String, SubwayArrivalDto> subwayData = new HashMap<>();
        // Redis에서 지하철 데이터 가져오기
        String subwayDataJson = redisTemplate.opsForValue().get("subway_data");
        if (subwayDataJson != null) {
            try {
                // Redis에서 가져온 JSON 문자열을 파싱
                JsonNode root = objectMapper.readTree(subwayDataJson);
                JsonNode upNode = root.path("up");
                JsonNode downNode = root.path("down");
                SubwayArrivalDto upDto = objectMapper.treeToValue(upNode, SubwayArrivalDto.class);
                SubwayArrivalDto downDto = objectMapper.treeToValue(downNode, SubwayArrivalDto.class);
                subwayData.put("up", upDto);
                subwayData.put("down", downDto);
                subwayData.entrySet().forEach(entry -> {
                    entry.getValue().getArrivalInfoList().forEach(info -> {
                        info.setRemainingTime(info.getRemainingTime());
                    });
                });
                // 남은 시간 기준 정렬
                subwayData.get("up").getArrivalInfoList().sort(
                        Comparator.comparingInt(info -> Integer.parseInt(info.getRemainingTime())));
                subwayData.get("down").getArrivalInfoList().sort(
                        Comparator.comparingInt(info -> Integer.parseInt(info.getRemainingTime())));

                // 상위 3개 데이터 유지
                List<SubwayArrivalInfo> upList = subwayData.get("up").getArrivalInfoList();
                upList.sort(Comparator.comparingInt(info -> Integer.parseInt(info.getRemainingTime())));
                if (upList.size() > 3) {
                    subwayData.get("up").setArrivalInfoList(new ArrayList<>(upList.subList(0, 3)));
                }
                List<SubwayArrivalInfo> downList = subwayData.get("down").getArrivalInfoList();
                downList.sort(Comparator.comparingInt(info -> Integer.parseInt(info.getRemainingTime())));
                if (downList.size() > 3) {
                    subwayData.get("down").setArrivalInfoList(new ArrayList<>(downList.subList(0, 3)));
                }
                String combinedJson = objectMapper.writeValueAsString(subwayData);
                redisTemplate.opsForValue().set("current_subway_data", combinedJson);
            } catch (JsonProcessingException e) {
                log.error("Error parsing subway data from Redis: {}", e.getMessage());
            }
        }
    }

    @PostConstruct
    public void init() {
        updateSubwayTimetable();
    }

    @Scheduled(cron = "0 0 3 * * *")
    public void updateSubwayTimetable() {
        log.debug("Updating subway timetable data...");
        List<SubwayTimetable> allTimetables = subwayTimetableRepository.findAll();
        Map<String, List<SubwayTimetable>> groupedByLine = allTimetables.stream()
                .collect(Collectors.groupingBy(SubwayTimetable::getUpdnLine));
        Map<String, SubwayTimeTableDto> resultList = new HashMap<>();

        String stationName = "죽전";
        groupedByLine.forEach((updnLine, timetables) -> {
            Map<String, List<SubwayTimetable>> timetablesByDayType = timetables.stream()
                    .collect(Collectors.groupingBy(SubwayTimetable::getDayOfWeek));

            List<SubwayScheduleDto.SubwaySchedule> weekdaySchedules = timetablesByDayType
                    .getOrDefault("평일", new ArrayList<>())
                    .stream()
                    .map(row -> new SubwayScheduleDto.SubwaySchedule(
                            row.getArrivalTime().toString(),
                            row.getLastStation(),
                            row.getFirstStation(),
                            row.getTrainNo(),
                            row.getFirstTrain(),
                            row.getLastTrain(),
                            row.getDayCount()))
                    .sorted(Comparator.comparingLong(SubwayScheduleDto.SubwaySchedule::getDayCount))
                    .collect(Collectors.toList());

            List<SubwayScheduleDto.SubwaySchedule> holidaySchedules = timetablesByDayType
                    .getOrDefault("휴일", new ArrayList<>())
                    .stream()
                    .map(row -> new SubwayScheduleDto.SubwaySchedule(
                            row.getArrivalTime().toString(),
                            row.getLastStation(),
                            row.getFirstStation(),
                            row.getTrainNo(),
                            row.getFirstTrain(),
                            row.getLastTrain(),
                            row.getDayCount()))
                    .sorted(Comparator.comparingLong(SubwayScheduleDto.SubwaySchedule::getDayCount))
                    .collect(Collectors.toList());

            List<SubwayScheduleDto> dayofweekList = new ArrayList<>();
            List<String> days = List.of("월", "화", "수", "목", "금", "토", "휴일");
            for (int i = 0; i < 5; i++) {
                dayofweekList.add(new SubwayScheduleDto(weekdaySchedules, days.get(i)));
            }

            dayofweekList.add(new SubwayScheduleDto(holidaySchedules, days.get(5)));
            dayofweekList.add(new SubwayScheduleDto(holidaySchedules, days.get(6)));

            resultList.put(updnLine, new SubwayTimeTableDto(updnLine, stationName, dayofweekList));
        });

        try {
            String uplineValue = objectMapper.writeValueAsString(resultList.get("상행"));
            String downlineValue = objectMapper.writeValueAsString(resultList.get("하행"));
            redisTemplate.opsForValue().set("subway_timetable_data_" + "up", uplineValue);
            redisTemplate.opsForValue().set("subway_timetable_data_" + "down", downlineValue);
        } catch (JsonProcessingException e) {
            log.error("Error serializing subway timetable data: {}", e.getMessage());
        }
        log.debug("Subway timetable data update completed.");
    }

    public String getCombinedSubwayInfo() {
        return redisTemplate.opsForValue().get("current_subway_data");
    }

    public String getSubwayTimetableInfo(String updnLine) {
        if (updnLine.equals("up")) {
            return redisTemplate.opsForValue().get("subway_timetable_data_up");
        } else {
            return redisTemplate.opsForValue().get("subway_timetable_data_down");
        }
    }
}
