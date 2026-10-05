package org.busondan.busondan.repository;

import java.util.List;

import org.busondan.busondan.entity.ArrivalLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ArrivalLogRepository extends JpaRepository<ArrivalLog, Long> {
    @Query(value = """
            WITH target_daycount AS (
                SELECT l.direction AS direction, l.day_count AS day_count
                FROM arrival_log l
                WHERE
                    l.station_name = :stationName
                    AND l.route_name = :routeName
                    AND l.day_of_week = :dayOfWeek
                    AND (
                        (TIME(l.arrival_time) >= CURTIME())
                        OR (TIME(l.arrival_time) < '03:00:00')
                    )
                GROUP BY l.direction, l.day_count
                ORDER BY COUNT(*) DESC, l.day_count ASC
                LIMIT 1
            ),
            day_averages AS (
                SELECT
                    l.direction AS direction,
                    l.day_count AS day_count,
                    AVG(TIME_TO_SEC(TIME(l.arrival_time))) AS avg_sec
                FROM arrival_log l
                JOIN target_daycount tdc
                    ON l.direction = tdc.direction
                   AND l.day_count IN (tdc.day_count, tdc.day_count + 1)
                WHERE
                    l.station_name = :stationName
                    AND l.route_name = :routeName
                    AND l.day_of_week = :dayOfWeek
                GROUP BY l.direction, l.day_count
            ),
            filtered AS (
                SELECT
                    l.direction AS direction,
                    l.day_count AS day_count,
                    SEC_TO_TIME(AVG(TIME_TO_SEC(TIME(l.arrival_time)))) AS filtered_avg_time
                FROM arrival_log l
                JOIN day_averages da
                    ON l.direction = da.direction
                   AND l.day_count = da.day_count
                WHERE
                    l.station_name = :stationName
                    AND l.route_name = :routeName
                    AND l.day_of_week = :dayOfWeek
                    AND ABS(TIME_TO_SEC(TIME(l.arrival_time)) - da.avg_sec) <= 300
                GROUP BY l.direction, l.day_count
            )
            SELECT f.direction, f.day_count, f.filtered_avg_time
            FROM filtered f
            ORDER BY f.direction ASC, f.day_count ASC;
                        """, nativeQuery = true)
    List<Object[]> findAvgForDaycountAndNextByDirection(
            @Param("stationName") String stationName,
            @Param("routeName") String routeName,
            @Param("dayOfWeek") String dayOfWeek);

    @Query(value = """
            WITH
                -- ===================================================================
                -- 1. "다른 버스" (셔틀버스 제외) : 이상치(±300초) 제거 로직 적용
                -- ===================================================================

                -- 1-1. 셔틀버스를 "제외한" 기본 로그
                OtherBusBase AS (
                  SELECT
                    station_name,
                    route_name,
                    direction,
                    day_of_week,
                    day_count,
                    arrival_time,
                    TIME_TO_SEC(TIME(arrival_time)) AS sec_time
                  FROM arrival_log
                  WHERE route_name != '셔틀버스' -- 셔틀버스 제외
                ),

                -- 1-2. "다른 버스"의 통계
                OtherBusStats AS (
                  SELECT
                    station_name,
                    route_name,
                    direction,
                    day_of_week,
                    day_count,
                    AVG(sec_time) AS avg_sec -- sec_time 컬럼 사용
                  FROM OtherBusBase -- 셔틀버스가 제외된 기본 로그 사용
                  GROUP BY station_name, route_name, direction, day_of_week, day_count
                ),

                -- 1-3. 이상치를 "제외한" "다른 버스" 로그
                OtherBusFiltered AS (
                  SELECT
                    b.station_name,
                    b.route_name,
                    b.direction,
                    b.day_of_week,
                    b.day_count,
                    b.arrival_time,
                    b.sec_time,
                    s.avg_sec
                  FROM OtherBusBase b
                  JOIN OtherBusStats s
                    ON b.station_name = s.station_name
                   AND b.route_name = s.route_name
                   AND b.direction = s.direction
                   AND b.day_of_week = s.day_of_week
                   AND b.day_count = s.day_count
                  WHERE ABS(b.sec_time - s.avg_sec) <= 300 -- 이상치 제거
                ),

                -- 1-4. "다른 버스"의 최종 시간표 (첫차/막차/평균)
                OtherBusTimetable AS (
                  SELECT
                    station_name,
                    route_name,
                    direction,
                    day_of_week,
                    day_count,
                    AVG(sec_time) AS avg_sec_val,
                    MIN(sec_time) AS first_sec_val,
                    MAX(sec_time) AS last_sec_val
                  FROM OtherBusFiltered
                  GROUP BY station_name, route_name, direction, day_of_week, day_count
                ),

                -- ===================================================================
                -- 2. "셔틀버스" : 가상 시간표 생성 로직 적용
                -- ===================================================================

                -- 2-1. 셔틀버스의 기준 출발 데이터 (모든 요일)
                PeaceSquareDepartures AS (
                    SELECT
                        arrival_time AS base_time,
                        day_of_week,
                        route_name,
                        direction, -- 'direction' 컬럼을 가져옵니다.
                        day_count
                    FROM
                        arrival_log
                    WHERE
                        route_name = '셔틀버스'
                        AND station_name = '평화의광장'
                ),
                -- 1-2. 기준 데이터 (죽전역 출발 - '단축 노선')
                -- :dayOfWeek 파라미터에 해당하는 '죽전역' 출발 데이터를 가져옵니다.
                JukjeonDepartures AS (
                    SELECT
                        arrival_time AS base_time, -- 기준 출발 시간
                        day_of_week,
                        route_name,
                        direction,
                        day_count
                    FROM
                        arrival_log
                    WHERE
                        route_name = '셔틀버스'
                        AND station_name = '죽전역' -- ★ 기준 2: 죽전역
                ),

                -- 2-2. 셔틀버스 전체 가상 시간표 (세로 포맷)
                ShuttleVirtualTimetable AS (
                    -- [블록 A] '평화의광장' 출발 전체 노선
                    -- (1) 평화의 광장 (기준 시간)
                    SELECT base_time AS arrival_time, '평화의광장' AS station_name, day_of_week, route_name, direction, day_count
                    FROM PeaceSquareDepartures

                    UNION ALL
                    -- (2) 인문관 (평광 + 2분)
                    SELECT ADDTIME(base_time, '00:02:00'), '인문관', day_of_week, route_name, direction, day_count
                    FROM PeaceSquareDepartures

                    UNION ALL
                    -- (3) 정문 (평광 + 4분)
                    SELECT ADDTIME(base_time, '00:05:00'), '정문', day_of_week, route_name, direction, day_count
                    FROM PeaceSquareDepartures

                    UNION ALL
                    -- (4) 죽전역 (평광 + 14분 / 21:00 출발 제외)
                    SELECT ADDTIME(base_time, '00:15:00'), '죽전역', day_of_week, route_name, direction, day_count
                    FROM PeaceSquareDepartures
                    WHERE TIME(base_time) != TIME('20:40:00') -- 21시 출발 버스는 운행 안 함
                    AND TIME(base_time) != TIME('21:00:00')

                    UNION ALL
                    -- (5) 치과병원 (평광 + 24분 / 21:00 출발 제외)
                    SELECT ADDTIME(base_time, '00:25:00'), '치과병원', day_of_week, route_name, direction, day_count
                    FROM PeaceSquareDepartures
                    WHERE TIME(base_time) != TIME('20:40:00') -- 21시 출발 버스는 운행 안 함
                    AND TIME(base_time) != TIME('21:00:00')

                    UNION ALL
                    -- (6) 종합실험동 (평광 + 26분 / 21:00 출발 제외)
                    SELECT ADDTIME(base_time, '00:27:00'), '종합실험동', day_of_week, route_name, direction, day_count
                    FROM PeaceSquareDepartures
                    WHERE TIME(base_time) != TIME('20:40:00') -- 21시 출발 버스는 운행 안 함
                    AND TIME(base_time) != TIME('21:00:00')
                    UNION ALL

                    -- [블록 B] '죽전역' 출발 단축 노선
                    -- (7) 죽전역 (기준 시간)
                    SELECT base_time AS arrival_time, '죽전역' AS station_name, day_of_week, route_name, direction, day_count
                    FROM JukjeonDepartures

                    UNION ALL
                    -- (8) 치과병원 (죽전역 + 10분)
                    SELECT ADDTIME(base_time, '00:10:00'), '치과병원', day_of_week, route_name, direction, day_count
                    FROM JukjeonDepartures

                    UNION ALL
                    -- (9) 종합실험동 (죽전역 + 12분)
                    SELECT ADDTIME(base_time, '00:12:00'), '종합실험동', day_of_week, route_name, direction, day_count
                    FROM JukjeonDepartures
                ),

                -- 2-3. "셔틀버스"의 최종 시간표 (첫차/막차/평균)
                ShuttleTimetable AS (
                    SELECT
                        station_name,
                        route_name,
                        direction,
                        day_of_week,
                        day_count,
                        AVG(TIME_TO_SEC(TIME(arrival_time))) AS avg_sec_val,
                        MIN(TIME_TO_SEC(TIME(arrival_time))) AS first_sec_val,
                        MAX(TIME_TO_SEC(TIME(arrival_time))) AS last_sec_val
                    FROM ShuttleVirtualTimetable
                    GROUP BY station_name, route_name, direction, day_of_week, day_count
                )

            -- ===================================================================
            -- 3. 최종 결합 (UNION ALL)
            -- ===================================================================
            SELECT
                station_name,
                route_name,
                direction,
                day_of_week,
                day_count,
                SEC_TO_TIME(avg_sec_val) AS avg_bus_time,
                SEC_TO_TIME(first_sec_val) AS first_bus_time,
                SEC_TO_TIME(last_sec_val) AS last_bus_time
            FROM
                OtherBusTimetable

            UNION ALL

            SELECT
                station_name,
                route_name,
                direction,
                day_of_week,
                day_count,
                SEC_TO_TIME(avg_sec_val) AS avg_bus_time,
                SEC_TO_TIME(first_sec_val) AS first_bus_time,
                SEC_TO_TIME(last_sec_val) AS last_bus_time
            FROM
                ShuttleTimetable

            ORDER BY
                route_name, station_name, day_of_week, day_count, direction;

                      """, nativeQuery = true)
    List<Object[]> findTimeTableList();

    @Query(value = """
            -- WITH 절을 사용하여 CTE(공통 테이블 식)를 정의합니다.
            WITH
                -- 1-1. 기준 데이터 (평화의광장 출발 - '전체 노선')
                -- :dayOfWeek 파라미터에 해당하는 '평화의광장' 출발 데이터를 가져옵니다.
                PeaceSquareDepartures AS (
                    SELECT
                        arrival_time AS base_time, -- 기준 출발 시간
                        day_of_week,
                        route_name,
                        direction,
                        day_count
                    FROM
                        arrival_log
                    WHERE
                        route_name = '셔틀버스'
                        AND station_name = '평화의광장' -- ★ 기준 1: 평화의광장
                        AND day_of_week = :dayOfWeek
                ),

                -- 1-2. 기준 데이터 (죽전역 출발 - '단축 노선')
                -- :dayOfWeek 파라미터에 해당하는 '죽전역' 출발 데이터를 가져옵니다.
                JukjeonDepartures AS (
                    SELECT
                        arrival_time AS base_time, -- 기준 출발 시간
                        day_of_week,
                        route_name,
                        direction,
                        day_count
                    FROM
                        arrival_log
                    WHERE
                        route_name = '셔틀버스'
                        AND station_name = '죽전역' -- ★ 기준 2: 죽전역
                        AND day_of_week = :dayOfWeek
                ),

                -- 2. 전체 가상 시간표 (세로 포맷)
                -- 두 출발지(평광, 죽전역)의 데이터를 UNION ALL로 합쳐 전체 시간표를 생성합니다.
                ProjectedTimetable AS (
                    -- [블록 A] '평화의광장' 출발 전체 노선
                    -- (1) 평화의 광장 (기준 시간)
                    SELECT base_time AS arrival_time, '평화의광장' AS station_name, day_of_week, route_name, direction, day_count
                    FROM PeaceSquareDepartures

                    UNION ALL
                    -- (2) 인문관 (평광 + 2분)
                    SELECT ADDTIME(base_time, '00:02:00'), '인문관', day_of_week, route_name, direction, day_count
                    FROM PeaceSquareDepartures

                    UNION ALL
                    -- (3) 정문 (평광 + 4분)
                    SELECT ADDTIME(base_time, '00:05:00'), '정문', day_of_week, route_name, direction, day_count
                    FROM PeaceSquareDepartures

                    UNION ALL
                    -- (4) 죽전역 (평광 + 14분 / 21:00 출발 제외)
                    SELECT ADDTIME(base_time, '00:15:00'), '죽전역', day_of_week, route_name, direction, day_count
                    FROM PeaceSquareDepartures
                    WHERE TIME(base_time) != TIME('20:40:00') -- 21시 출발 버스는 운행 안 함
                    AND TIME(base_time) != TIME('21:00:00')

                    UNION ALL
                    -- (5) 치과병원 (평광 + 24분 / 21:00 출발 제외)
                    SELECT ADDTIME(base_time, '00:25:00'), '치과병원', day_of_week, route_name, direction, day_count
                    FROM PeaceSquareDepartures
                    WHERE TIME(base_time) != TIME('20:40:00') -- 21시 출발 버스는 운행 안 함
                    AND TIME(base_time) != TIME('21:00:00')

                    UNION ALL
                    -- (6) 종합실험동 (평광 + 26분 / 21:00 출발 제외)
                    SELECT ADDTIME(base_time, '00:27:00'), '종합실험동', day_of_week, route_name, direction, day_count
                    FROM PeaceSquareDepartures
                    WHERE TIME(base_time) != TIME('20:40:00') -- 21시 출발 버스는 운행 안 함
                    AND TIME(base_time) != TIME('21:00:00')

                    UNION ALL

                    -- [블록 B] '죽전역' 출발 단축 노선
                    -- (7) 죽전역 (기준 시간)
                    SELECT base_time AS arrival_time, '죽전역' AS station_name, day_of_week, route_name, direction, day_count
                    FROM JukjeonDepartures

                    UNION ALL
                    -- (8) 치과병원 (죽전역 + 10분)
                    SELECT ADDTIME(base_time, '00:10:00'), '치과병원', day_of_week, route_name, direction, day_count
                    FROM JukjeonDepartures

                    UNION ALL
                    -- (9) 종합실험동 (죽전역 + 12분)
                    SELECT ADDTIME(base_time, '00:12:00'), '종합실험동', day_of_week, route_name, direction, day_count
                    FROM JukjeonDepartures
                ),

                -- 3. 순위 매기기
                -- 생성된 "통합" 가상 시간표에서 "현재 시간 이후"의 데이터만 필터링하고,
                -- 각 정류장(station_name)별로 도착 시간(arrival_time)이 빠른 순서대로 순위를 매깁니다.
                RankedArrivals AS (
                    SELECT
                        pt.*,
                        ROW_NUMBER() OVER(
                            PARTITION BY pt.station_name -- 각 정류장 별로
                            ORDER BY pt.arrival_time ASC -- 도착 시간을 오름차순으로 정렬
                        ) AS rn
                    FROM
                        ProjectedTimetable AS pt
                    WHERE
                        TIME(pt.arrival_time) > CURRENT_TIME() -- "현재 시간" 이후의 버스만 조회
                )

            -- 4. 최종 결과 선택
            -- 순위가 1 또는 2인 (즉, 가장 빨리 오는 2개의 버스) 데이터만 선택합니다.
            SELECT
                ra.arrival_time,
                ra.day_of_week,
                ra.route_name,
                ra.station_name,
                ra.direction,
                ra.day_count
            FROM
                RankedArrivals AS ra
            WHERE
                ra.rn <= 2 -- 순위가 1위, 2위인 데이터만 필터링
            ORDER BY
                ra.station_name, -- 정류장 이름 순
                ra.arrival_time; -- 도착 시간 순
                              """, nativeQuery = true)
    List<Object[]> findShuttleBusLogs(@Param("dayOfWeek") String dayOfWeek);
}
