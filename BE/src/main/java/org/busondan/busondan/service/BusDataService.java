package org.busondan.busondan.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.busondan.busondan.dto.BusArrivalDto;
import org.busondan.busondan.dto.BusTimeTableDto;
import org.busondan.busondan.dto.PredictedBusArrivalDto;
import org.busondan.busondan.dto.StationBusInfoDto;
import org.busondan.busondan.entity.BusTimetable;
import org.busondan.busondan.repository.ArrivalLogRepository;
import org.busondan.busondan.repository.BusTimetableRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Slf4j
@Service
@RequiredArgsConstructor
public class BusDataService {

    private final StringRedisTemplate redisTemplate;
    private final ArrivalLogRepository arrivalLogRepository;
    private final BusTimetableRepository busTimetableRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    private static final String REDIS_LOG_PREFIX = "buslog:";

    @Value("${ggbis.api.key}")
    private String apiKey;

    private static final Map<String, String> STATION_INFO = Map.of(
            "228001737", "치과병원", "228001979", "종합실험동", "228001980", "평화의광장",
            "228001028", "죽전역", "228001981", "인문관", "228001978", "정문");
    private static final Map<String, String> STATION_INFO_REVERSE = STATION_INFO.entrySet().stream()
            .collect(Collectors.toMap(Map.Entry::getValue, Map.Entry::getKey));

    // 4. Map.of()는 10개 이상의 항목을 지원하지 않으므로 Map.ofEntries()로 수정
    private static final Map<String, String> ROUTE_INFO = Map.ofEntries(
            Map.entry("24", "241428004"), Map.entry("720-3", "234000068"), Map.entry("31-1", "241424008"),
            Map.entry("8100", "234000878"), Map.entry("1101", "234000879"), Map.entry("102", "206000007"),
            Map.entry("1101N", "228000418"), Map.entry("7007-1", "228000393"), Map.entry("39-1", "241423013"),
            Map.entry("26-3", "241427008"), Map.entry("셔틀버스", "999999999"));

    private static final Map<DayOfWeek, String> WEEKDAY_MAP = Map.of(
            DayOfWeek.MONDAY, "월", DayOfWeek.TUESDAY, "화", DayOfWeek.WEDNESDAY, "수",
            DayOfWeek.THURSDAY, "목", DayOfWeek.FRIDAY, "금", DayOfWeek.SATURDAY, "토",
            DayOfWeek.SUNDAY, "휴일");

    @Getter
    @Setter
    @AllArgsConstructor
    private class BusArrivalData {
        String plateNo;
        LocalDateTime arrivalTime;
        String delta;
        Long dayCount;
    }

@Scheduled(cron = "0 0 3 * * *")
    public void pushLogAndClear() {
        log.debug("🧹 Starting scheduled log processing from Redis...");
        
        String curDayOfWeek = WEEKDAY_MAP.get(LocalDate.now(ZoneId.of("Asia/Seoul")).minusDays(1).getDayOfWeek());

        // 1. Redis에서 모든 로그 키 조회 (예: "buslog:*")
        Set<String> redisKeys = redisTemplate.keys(REDIS_LOG_PREFIX + "*");
        
        if (redisKeys == null || redisKeys.isEmpty()) {
            log.debug("🧹 No logs found in Redis to process.");
            return;
        }

        List<BusTimetable> logsToSave = new ArrayList<>();

        for (String redisKey : redisKeys) {
            // 2. 키에서 stationId와 routeName 추출
            // (키 형식: "buslog:stationId:routeName")
            String[] parts = redisKey.split(":");
            if (parts.length < 3) continue;
            
            String stationId = parts[1];
            String routeName = parts[2]; // parts[2] 부터 끝까지 join해야 할 수도 있음
            String stationName = STATION_INFO.get(stationId);

            if (stationName == null) {
                log.warn("Cannot find stationName for stationId: {}", stationId);
                continue;
            }

            // 3. Redis List에서 모든 데이터(JSON 문자열) 가져오기
            List<String> jsonDataList = redisTemplate.opsForList().range(redisKey, 0, -1);
            if (jsonDataList == null || jsonDataList.isEmpty()) {
                continue;
            }

            // 4. [중요] 중복 제거 및 dayCount 계산 (기존 로직)
            BusArrivalData lastData = null;
            long dayCount = 1L;

            for (String jsonData : jsonDataList) {
                try {
                    BusArrivalData currentData = objectMapper.readValue(jsonData, BusArrivalData.class);
                    
                    boolean shouldSave = false;
                    if (lastData == null) {
                        shouldSave = true; // 첫 번째 데이터
                    } else if (!lastData.getPlateNo().equals(currentData.getPlateNo())
                            || !lastData.getDelta().equals(currentData.getDelta())) {
                        shouldSave = true; // 차량 번호나 상태가 변경됨
                    }

                    if (shouldSave) {
                        // DB에 저장할 최종 LogEntry 생성
                        BusTimetable logEntry = new BusTimetable(
                                currentData.getArrivalTime(),
                                curDayOfWeek,
                                routeName,
                                stationName,
                                currentData.getPlateNo(),
                                currentData.getDelta(),
                                dayCount); // 여기서 올바른 dayCount를 할당
                        
                        logsToSave.add(logEntry);
                        
                        lastData = currentData;
                        dayCount++;
                    }
                } catch (JsonProcessingException e) {
                    log.error("❌ (Redis) JSON deserialization failed", e);
                }
            }
        }

        // 5. DB에 일괄 저장 (Batch Insert)
        if (!logsToSave.isEmpty()) {
            busTimetableRepository.saveAll(logsToSave);
            log.info("✅ Saved {} processed bus logs to DB.", logsToSave.size());
        }

        // 6. Redis에서 처리 완료된 키 삭제
        redisTemplate.delete(redisKeys);
        log.debug("🧹 Cleared {} log keys from Redis.", redisKeys.size());
    }

    @Scheduled(fixedRate = 10_000)
    public void logBusArrvials() {
        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
        if (now.getHour() > 1 && now.getHour() < 5) {
            log.debug("⏸️ (Redis) Outside operational hours. Skipping data fetch.");
            return;
        }
        if ("YOUR_API_KEY".equals(apiKey))
            return;
        
        log.debug("🔄 (Redis) Fetching real-time bus location info...");
        String baseUrl = "https://apis.data.go.kr/6410000/buslocationservice/v2/getBusLocationListv2";
        
        for (String routeName : ROUTE_INFO.keySet()) {
            String url = String.format("%s?serviceKey=%s&routeId=%s",
                    baseUrl, apiKey, ROUTE_INFO.get(routeName));
            URI uri = URI.create(url);
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.set("User-Agent", "Mozilla/5.0");
                HttpEntity<String> entity = new HttpEntity<>(headers);

                ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.GET, entity, String.class);
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode arrivalList = root.path("response").path("msgBody").path("busLocationList");
                
                if (arrivalList != null && arrivalList.isArray()) {
                    StreamSupport.stream(arrivalList.spliterator(), false)
                            .forEach(item -> {
                                String plateNo = item.path("plateNo").asText("");
                                String stationId = item.path("stationId").asText("");
                                String stateCd = item.path("stateCd").asText("");

                                // [로직 수정] 
                                // stationId가 우리가 추적하는 정류장이 맞는지 확인
                                if (STATION_INFO.containsKey(stationId)) { 
                                    String delta = "";
                                    if (stateCd.equals("1")) {
                                        delta = "도착";
                                    } else if (stateCd.equals("2")) {
                                        delta = "출발";
                                    } else {
                                        delta = "이동중";
                                    }

                                    // 1. Redis 키 생성 (예: "buslog:12345:5000번")
                                    String redisKey = REDIS_LOG_PREFIX + stationId + ":" + routeName;
                                    
                                    // 2. Redis에 저장할 데이터 생성 (dayCount는 3시에 계산하므로 0L)
                                    BusArrivalData data = new BusArrivalData(plateNo, now, delta, 0L); 

                                    try {
                                        // 3. JSON 문자열로 변환
                                        String jsonData = objectMapper.writeValueAsString(data);
                                        // 4. Redis List에 RPUSH (가장 오른쪽에 추가)
                                        redisTemplate.opsForList().rightPush(redisKey, jsonData);
                                    } catch (JsonProcessingException e) {
                                        log.error("❌ (Redis) JSON serialization failed", e);
                                    }
                                }
                            });
                }
            } catch (RestClientException | JsonProcessingException e) {
                log.error("❌ (Redis) Error for routeName {}: {}", routeName, e.getMessage());
            }
        }
    }

    @Scheduled(fixedRate = 10_000)
    public void fetchAndStoreRealTimeData() {
        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
        if (now.getHour() > 1 && now.getHour() < 5) {
            log.debug("⏸️ (Redis) Outside operational hours. Skipping data fetch.");
            return;
        }
        if ("YOUR_API_KEY".equals(apiKey))
            return;
        log.debug("🔄 (Redis) Fetching real-time bus arrival info...");
        String baseUrl = "https://apis.data.go.kr/6410000/busarrivalservice/v2/getBusArrivalListv2";
        for (String stationId : STATION_INFO.keySet()) {
            String url = String.format("%s?serviceKey=%s&stationId=%s",
                    baseUrl, apiKey, stationId);
            URI uri = URI.create(url);
            log.debug(url);
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.set("User-Agent", "Mozilla/5.0");
                HttpEntity<String> entity = new HttpEntity<>(headers);

                ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.GET, entity, String.class);
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode arrivalList = root.path("response").path("msgBody").path("busArrivalList");

                List<BusArrivalDto> processedList = new ArrayList<>();
                if (arrivalList != null && arrivalList.isArray()) {
                    processedList = StreamSupport.stream(arrivalList.spliterator(), false)
                            .map(item -> {
                                BusArrivalDto dto = new BusArrivalDto(
                                        item.path("routeName").asText(""),
                                        item.path("routeDestName").asText(""),
                                        item.path("predictTime1").asText(""),
                                        item.path("predictTime2").asText(""),
                                        "live");
                                if (stationId.equals("228001978")) {
                                    log.debug("BusArrivalDto: {}", dto);
                                }
                                return dto;
                            })
                            .filter(Objects::nonNull)
                            .collect(Collectors.toList());
                }
                redisTemplate.opsForValue().set("station:" + stationId, objectMapper.writeValueAsString(processedList),
                        500, TimeUnit.SECONDS);
            } catch (RestClientException | JsonProcessingException e) {
                log.error("❌ (Redis) Error for station {}: {}", stationId, e.getMessage());
            }
        }
    }

    public Map<String, BusArrivalDto> getShuttleBusTimetable() {
        Map<String, BusArrivalDto> shuttleBusResult = new HashMap<>();
        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
        if (now.getHour() >= 0 && now.getHour() < 3) {
            STATION_INFO.entrySet().forEach(entry -> {
                String stationName = entry.getValue();
                if (!shuttleBusResult.containsKey(stationName)) {
                    BusArrivalDto dto = new BusArrivalDto(
                            "셔틀버스",
                            "캠퍼스 순환",
                            "",
                            "",
                            "timetable");
                    shuttleBusResult.put(stationName, dto);
                }
            });
            return shuttleBusResult;
        } else if (now.toLocalTime().isBefore(LocalTime.of(8, 15))) {
            Duration duration = Duration.between(now.toLocalTime(), LocalTime.of(8, 15));
            STATION_INFO.entrySet().forEach(entry -> {
                String stationName = entry.getValue();
                if (!shuttleBusResult.containsKey(stationName)) {
                    BusArrivalDto dto = new BusArrivalDto(
                            "셔틀버스",
                            "캠퍼스 순환",
                            String.valueOf(duration.toMinutes()),
                            "",
                            "timetable");
                    shuttleBusResult.put(stationName, dto);
                } else {
                    BusArrivalDto dto = new BusArrivalDto(
                            "셔틀버스",
                            "캠퍼스 순환",
                            "",
                            "",
                            "timetable");
                    shuttleBusResult.put(stationName, dto);
                }
            });
            return shuttleBusResult;
        }
        if (!now.toLocalTime().isBefore(LocalTime.of(8, 15)) 
            && !now.toLocalTime().isAfter(LocalTime.of(10, 15)) 
            && !WEEKDAY_MAP.get(now.getDayOfWeek()).equals("토")
            && !WEEKDAY_MAP.get(now.getDayOfWeek()).equals("휴일")) {
            STATION_INFO.entrySet().forEach(entry -> {
                String stationName = entry.getValue();
                if (!shuttleBusResult.containsKey(stationName)) {
                    BusArrivalDto dto = new BusArrivalDto(
                            "셔틀버스",
                            "캠퍼스 순환",
                            "수시 운행 중",
                            "",
                            "timetable");
                    shuttleBusResult.put(stationName, dto);
                }
            });
            return shuttleBusResult;
        }
        String dayofWeek = WEEKDAY_MAP.get(now.getDayOfWeek());
        List<Object[]> shuttleBuses = arrivalLogRepository.findShuttleBusLogs(dayofWeek);
        final DateTimeFormatter DB_LOG_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.S");
        Map<String, List<BusTimeTableDto>> shuttleBusTimetable = shuttleBuses.stream()
                .map(row -> {
                    LocalDateTime dateTime = row[0] != null ? LocalDateTime.parse(row[0].toString(), DB_LOG_FORMATTER)
                            : null;
                    LocalTime arrivalTime = dateTime.toLocalTime();
                    String direction = "캠퍼스 순환";
                    String routeName = row[2].toString();
                    String stationName = row[3].toString();
                    Integer dayCount = ((Number) row[5]).intValue();
                    return new BusTimeTableDto(
                            stationName,
                            routeName,
                            direction,
                            dayofWeek,
                            dayCount,
                            arrivalTime,
                            arrivalTime,
                            arrivalTime);
                })
                .collect(Collectors.groupingBy(BusTimeTableDto::getStationName));
        try {
            shuttleBusTimetable.entrySet().forEach(entry -> {
                String stationName = entry.getKey();
                LocalTime secondRemainingTime = null;
                LocalTime nowTime = LocalTime.now(ZoneId.of("Asia/Seoul"));
                Duration duration1 = Duration.between(nowTime, entry.getValue().get(0).getAverageTime());
                Duration duration2 = Duration.ofMinutes(-1);
                if (entry.getValue().size() < 1) {
                    return;
                } else if (entry.getValue().size() > 1) {
                    secondRemainingTime = entry.getValue().get(1).getAverageTime();
                    duration2 = Duration.between(nowTime, secondRemainingTime);
                }
                BusArrivalDto dto = new BusArrivalDto(
                        entry.getValue().get(0).getRouteId(),
                        entry.getValue().get(0).getDirection(),
                        duration1.isNegative() ? "" : String.valueOf(duration1.toMinutes()),
                        duration2.isNegative() ? "" : String.valueOf(duration2.toMinutes()),
                        "timetable");
                shuttleBusResult.put(stationName, dto);
            });

        } catch (Exception e) {
            log.error("❌ Error processing shuttle bus timetable: {}", e.getMessage());
        }
        STATION_INFO.entrySet().forEach(entry -> {
            String stationName = entry.getValue();
            if (!shuttleBusResult.containsKey(stationName)) {
                BusArrivalDto dto = new BusArrivalDto(
                        "셔틀버스",
                        "캠퍼스 순환",
                        "",
                        "",
                        "");
                shuttleBusResult.put(stationName, dto);
            }
        });
        return shuttleBusResult;
    }

    @Scheduled(fixedRate = 5_000)
    public void updateCombinedBusInfo() {
        log.debug("✅ (Cache) Updating combined bus info...");
        Map<String, StationBusInfoDto> allBusData = new LinkedHashMap<>();
        Map<String, List<String>> stationsNeedingPrediction = new HashMap<>();

        for (Map.Entry<String, String> stationEntry : STATION_INFO.entrySet()) {
            String stationId = stationEntry.getKey();
            String stationName = stationEntry.getValue();
            Set<String> processedRoutes = new HashSet<>();
            List<BusArrivalDto> finalBusList = new ArrayList<>();
            List<String> missingRoutes = new ArrayList<>();
            try {
                String busListJson = redisTemplate.opsForValue().get("station:" + stationId);

                if (busListJson != null && !busListJson.isEmpty()) {
                    List<BusArrivalDto> liveBusList = objectMapper.readValue(busListJson,
                            new com.fasterxml.jackson.core.type.TypeReference<>() {
                            });
                    for (BusArrivalDto bus : liveBusList) {
                        processedRoutes.add(bus.routeName());
                        if (bus.firstRemainingTime() != null && bus.firstRemainingTime().matches("\\d+")) {
                            long remainingMinutes = Long.parseLong(bus.firstRemainingTime());
                            long secondRemainingTime = -1;
                            if (bus.secondRemainingTime() != null && bus.secondRemainingTime().matches("\\d+")) {
                                secondRemainingTime = Long.parseLong(bus.secondRemainingTime());
                                secondRemainingTime = Math.max(secondRemainingTime, 0);
                            }
                            String secondTimeStr = (secondRemainingTime >= 0) ? String.valueOf(secondRemainingTime)
                                    : "";
                            String remainingTimeStr = (remainingMinutes >= 0) ? String.valueOf(remainingMinutes) : "0";
                            finalBusList.add(new BusArrivalDto(bus.routeName(), bus.direction(),
                                    remainingTimeStr, secondTimeStr, bus.type()));
                        } else {
                            missingRoutes.add(bus.routeName());
                        }
                    }
                }
            } catch (JsonProcessingException e) {
                log.error("❌ Error parsing redis data for station {}: {}", stationId, e.getMessage());
            }
            stationsNeedingPrediction.put(stationName, missingRoutes);
            allBusData.put(stationId, new StationBusInfoDto(stationName, finalBusList));
        }

        try {
            Map<String, List<BusArrivalDto>> timetablePredictions = getTimetablePredictions(stationsNeedingPrediction);

            Map<String, BusArrivalDto> shuttleBus = getShuttleBusTimetable();

            shuttleBus.entrySet().forEach(entry -> {
                String stationName = entry.getKey();
                allBusData.get(STATION_INFO_REVERSE.get(stationName)).busList().add(entry.getValue());
            });

            for (Map.Entry<String, StationBusInfoDto> entry : allBusData.entrySet()) {
                String stationName = entry.getValue().stationName();
                if (timetablePredictions.containsKey(stationName)) {
                    entry.getValue().busList().addAll(timetablePredictions.get(stationName));
                }
                entry.getValue().busList().sort(Comparator.comparingInt(b -> {
                    try {
                        return Integer.parseInt(b.firstRemainingTime().trim());
                    } catch (Exception e) {
                        return Integer.MAX_VALUE;
                    }
                }));

            }
            stationsNeedingPrediction.entrySet().forEach(entry -> {
                String stationName = entry.getKey();
                entry.getValue().forEach(routeName -> {
                    BusArrivalDto dto = new BusArrivalDto(
                            routeName,
                            "",
                            "",
                            "",
                            "");
                    allBusData.get(STATION_INFO_REVERSE.get(stationName)).busList().add(dto);
                });
            });
        } catch (Exception e) {
            log.error("❌ Error processing timetable predictions: {}", e.getMessage());
        }

        try {
            redisTemplate.opsForValue().set("current_bus_data", objectMapper.writeValueAsString(allBusData), 500,
                    TimeUnit.SECONDS);
        } catch (JsonProcessingException e) {
            log.error("❌ Failed to save final bus data to Redis: {}", e.getMessage());
        }
    }

    @PostConstruct
    public void init() {
        updateBusTimetable();
    }

    @Scheduled(cron = "0 0 3 * * *")
    public void updateBusTimetable() {
        log.debug("🗓️ Updating bus timetable data at 3 AM...");
        List<Object[]> results = arrivalLogRepository.findTimeTableList();
        DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("HH:mm");
        Map<String, List<BusTimeTableDto>> timetableMap = results.stream()
                .map(row -> {
                    String stationName = row[0].toString();
                    String routeId = row[1].toString();
                    String direction = row[2].toString();
                    String dayOfWeek = row[3].toString();
                    Integer dayCount = ((Number) row[4]).intValue();
                    LocalTime avgTime = row[5] != null ? LocalTime.parse(row[5].toString()) : null;
                    LocalTime firstTime = row[6] != null ? LocalTime.parse(row[6].toString()) : null;
                    LocalTime lastTime = row[7] != null ? LocalTime.parse(row[7].toString()) : null;
                    return new BusTimeTableDto(stationName, routeId, direction, dayOfWeek, dayCount, avgTime, firstTime,
                            lastTime);
                })
                .collect(Collectors.groupingBy(BusTimeTableDto::getStationName));
        try {
            for (Map.Entry<String, List<BusTimeTableDto>> entry : timetableMap.entrySet()) {
                Map<String, List<BusTimeTableDto>> routeGrouped = entry.getValue().stream()
                        .collect(Collectors.groupingBy(BusTimeTableDto::getRouteId,
                                Collectors.collectingAndThen(
                                        Collectors.toList(),
                                        list -> list.stream()
                                                .sorted(Comparator.comparingInt(BusTimeTableDto::getDayCount))
                                                .collect(Collectors.toList()))));
                for (Map.Entry<String, List<BusTimeTableDto>> routeEntry : routeGrouped.entrySet()) {
                    Map<String, List<BusTimeTableDto>> byDay = routeEntry.getValue().stream()
                            .collect(Collectors.groupingBy(
                                    BusTimeTableDto::getDayOfWeek,
                                    Collectors.collectingAndThen(
                                            Collectors.toList(),
                                            list -> list.stream()
                                                    .sorted(Comparator.comparingInt(BusTimeTableDto::getDayCount))
                                                    .collect(Collectors.toList()))));

                    List<Map<String, Object>> dayList = byDay.entrySet().stream()
                            .map(e -> {
                                List<Map<String, Object>> timetableList = e.getValue().stream()
                                        .map(item -> {
                                            Map<String, Object> m = new LinkedHashMap<>();
                                            m.put("id", item.getDayCount());
                                            m.put("fastest", item.getFirstBusTime() != null
                                                    ? item.getFirstBusTime().format(timeFormatter)
                                                    : "");
                                            m.put("latest", item.getLastBusTime() != null
                                                    ? item.getLastBusTime().format(timeFormatter)
                                                    : "");
                                            m.put("predict", item.getAverageTime() != null
                                                    ? item.getAverageTime().format(timeFormatter)
                                                    : "");
                                            return m;
                                        })
                                        .collect(Collectors.toList());

                                return Map.<String, Object>of(
                                        "name", e.getKey(),
                                        "timetable", timetableList);
                            })
                            .collect(Collectors.toList());
                    Map<String, Object> ret = new LinkedHashMap<>();
                    ret.put("stationId", STATION_INFO_REVERSE.get(entry.getKey()));
                    ret.put("stationName", entry.getKey());
                    ret.put("endStationName", routeEntry.getValue().get(0).getDirection());
                    ret.put("dayofweek", dayList);
                    redisTemplate.opsForValue().set(
                            "bus_timetable_" + STATION_INFO_REVERSE.get(entry.getKey()) + "_" + routeEntry.getKey(),
                            objectMapper.writeValueAsString(ret), 24, TimeUnit.HOURS);
                }
            }
            log.debug("✅ Bus timetable data updated successfully.");
        } catch (JsonProcessingException e) {
            log.error("❌ Failed to save bus timetable data to Redis: {}", e.getMessage());
        }
    }

    private Map<String, List<BusArrivalDto>> getTimetablePredictions(
            Map<String, List<String>> stationsNeedingPrediction) {
        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Seoul"));

        // 새벽 3시 이전이면 전날로 간주
        String currentDay = WEEKDAY_MAP.get(now.getDayOfWeek());
        if (now.getHour() < 3) {
            currentDay = WEEKDAY_MAP.get(now.minusDays(1).getDayOfWeek());
        }

        // 처리할 정류장이 없으면 빈 맵 반환
        if (stationsNeedingPrediction.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<String, List<BusArrivalDto>> finalPredictions = new HashMap<>();

        // 처리가 필요한 정류장과 노선에 대해 예측 수행 (복제하여 반복문에서 수정 방지)
        for (Map.Entry<String, List<String>> entry : new HashMap<>(stationsNeedingPrediction).entrySet()) {
            String stationName = entry.getKey(); // 정류장 이름
            List<String> routesFoundInTimetable = new ArrayList<>(); // 시간표에서 찾은 노선 목록 (삭제를 하기 위해)

            // 각 노선에 대해 예측 수행
            for (String routeName : entry.getValue()) {
                // 정류장 - 노선 - 오늘 요일에 따른 예측 도착 시간 조회
                List<Object[]> results = arrivalLogRepository.findAvgForDaycountAndNextByDirection(stationName,
                        routeName, currentDay);
                // 조회 결과를 방향별로 그룹화하여 PredictedBusArrivalDto 리스트로 변환
                Map<String, List<PredictedBusArrivalDto>> predictions = results.stream()
                        .map(row -> {
                            String direction = row[0].toString();
                            Integer dayCount = ((Number) row[1]).intValue();
                            LocalTime predictTime = row[2] != null
                                    ? LocalTime.parse(row[2].toString())
                                    : null;
                            return new PredictedBusArrivalDto(direction, dayCount, predictTime);
                        })
                        .collect(Collectors.groupingBy(PredictedBusArrivalDto::getDirection));
                // 예측된 도착 시간이 없으면 다음 노선으로
                if (predictions.isEmpty()) {
                    continue;
                }
                // 시간표에서 찾은 노선으로 표시
                routesFoundInTimetable.add(routeName);

                // 각 방향별로 예측된 도착 시간 처리
                for (Map.Entry<String, List<PredictedBusArrivalDto>> entry2 : predictions.entrySet()) {
                    String direction = entry2.getKey(); // 방향 정보
                    List<PredictedBusArrivalDto> arrivals = entry2.getValue(); // 방향별 2건의 예측 데이터

                    // 막차 이후 버스 예측 제거 로직
                    if (now.getHour() >= 0 && now.getHour() < 3) {
                        if (arrivals.size() > 0 && arrivals.get(0).getDayCount() == 1) {
                            routesFoundInTimetable.remove(routeName);
                            continue;
                        }
                    }

                    // 첫번째 시간 데이터 계산
                    String firstRemainingTime = "";
                    if (arrivals.size() > 0 && arrivals.get(0).getPredictedTime() != null) {
                        LocalTime predicted = arrivals.get(0).getPredictedTime();
                        Duration duration = Duration.between(now.toLocalTime(), predicted);
                        if (duration.isNegative()) {
                            duration = duration.plusHours(24);
                        }
                        firstRemainingTime = String.valueOf(duration.toMinutes());
                    }

                    // 두번째 시간 데이터 계산
                    String secondRemainingTime = "";
                    if (arrivals.size() > 1 && arrivals.get(1).getPredictedTime() != null) {
                        LocalTime predicted = arrivals.get(1).getPredictedTime();
                        Duration duration = Duration.between(now.toLocalTime(), predicted);
                        if (duration.isNegative()) {
                            duration = duration.plusHours(24);
                        }
                        secondRemainingTime = String.valueOf(duration.toMinutes());
                    }

                    // 최종 DTO 생성 및 맵에 추가
                    BusArrivalDto dto = new BusArrivalDto(
                            routeName,
                            direction,
                            firstRemainingTime,
                            secondRemainingTime,
                            "timetable");
                    finalPredictions.computeIfAbsent(stationName, k -> new ArrayList<>()).add(dto);
                }
            }
            // 처리된 노선을 원본 맵에서 제거
            if (stationsNeedingPrediction.containsKey(stationName)) {
                stationsNeedingPrediction.get(stationName).removeAll(routesFoundInTimetable);
            }
        }
        return finalPredictions;
    }

    public String getCombinedBusInfo() {
        return redisTemplate.opsForValue().get("current_bus_data");
    }

    public String getBusTimetable(String stationId, String routeId) {
        log.debug("Fetching timetable for Station ID: {}, Route ID: {}", stationId, routeId);
        return redisTemplate.opsForValue().get("bus_timetable_" + stationId + "_" + routeId);
    }
}