package org.busondan.busondan.repository;

import java.util.List;

import org.busondan.busondan.entity.BusTimetable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BusTimetableRepository extends JpaRepository<BusTimetable, Long> {
    @Query(value = """
            WITH target_daycount AS (
                SELECT l.direction AS direction, l.day_count AS day_count
                FROM bus_timetable l  /* <--- 테이블 이름 수정 */
                WHERE
                    l.station_name = :stationName
                    AND l.route_name = :routeName
                    AND l.day_of_week = :dayOfWeek
                    AND l.delta = '도착'
                    AND (
                        (TIME(l.arrivalTime) >= CURTIME())
                        OR (TIME(l.arrivalTime) < '03:00:00')
                    )
                GROUP BY l.direction, l.day_count
                ORDER BY COUNT(*) DESC, l.day_count ASC
                LIMIT 1
            ),
            day_averages AS (
                SELECT
                    l.direction AS direction,
                    l.day_count AS day_count,
                    AVG(TIME_TO_SEC(TIME(l.arrivalTime))) AS avg_sec
                FROM bus_timetable l  /* <--- 테이블 이름 수정 */
                JOIN target_daycount tdc
                    ON l.direction = tdc.direction
                   AND l.day_count IN (tdc.day_count, tdc.day_count + 1)
                WHERE
                    l.station_name = :stationName
                    AND l.route_name = :routeName
                    AND l.day_of_week = :dayOfWeek
                    AND l.delta = '도착'
                GROUP BY l.direction, l.day_count
            ),
            filtered AS (
                SELECT
                    l.direction AS direction,
                    l.day_count AS day_count,
                    SEC_TO_TIME(AVG(TIME_TO_SEC(TIME(l.arrivalTime)))) AS filtered_avg_time
                FROM bus_timetable l  /* <--- 테이블 이름 수정 */
                JOIN day_averages da
                    ON l.direction = da.direction
                   AND l.day_count = da.day_count
                WHERE
                    l.station_name = :stationName
                    AND l.route_name = :routeName
                    AND l.day_of_week = :dayOfWeek
                    AND l.delta = '도착'
                    AND ABS(TIME_TO_SEC(TIME(l.arrivalTime)) - da.avg_sec) <= 300
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
            WITH base AS (
              SELECT
                station_name,
                route_name,
                direction,
                day_of_week,
                day_count,
                arrivalTime,
                TIME_TO_SEC(TIME(arrivalTime)) AS sec_time
              FROM bus_timetable /* <--- 테이블 이름 수정 */
              WHERE delta = '도착'
            ),
            stats AS (
              SELECT
                station_name,
                route_name,
                direction,
                day_of_week,
                day_count,
                AVG(TIME_TO_SEC(TIME(arrivalTime))) AS avg_sec
              FROM bus_timetable /* <--- 테이블 이름 수정 */
              WHERE delta = '도착'
              GROUP BY station_name, route_name, direction, day_of_week, day_count
            ),
            filtered AS (
              SELECT
                b.station_name,
                b.route_name,
                b.direction,
                b.day_of_week,
                b.day_count,
                b.arrivalTime,
                b.sec_time,
                s.avg_sec
              FROM base b
              JOIN stats s
                ON b.station_name = s.station_name
               AND b.route_name = s.route_name
               AND b.direction = s.direction
               AND b.day_of_week = s.day_of_week
               AND b.day_count = s.day_count
              WHERE ABS(b.sec_time - s.avg_sec) <= 300
            )
            SELECT
              station_name,
              route_name,
              direction,
              day_of_week,
              day_count,
              SEC_TO_TIME(AVG(sec_time)) AS avg_bus_time,
              SEC_TO_TIME(MIN(sec_time)) AS first_bus_time,
              SEC_TO_TIME(MAX(sec_time)) AS last_bus_time
            FROM filtered
            GROUP BY station_name, route_name, direction, day_of_week, day_count;

                """, nativeQuery = true)
    List<Object[]> findTimeTableList();
}
