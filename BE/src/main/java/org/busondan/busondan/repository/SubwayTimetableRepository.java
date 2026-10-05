package org.busondan.busondan.repository;

import java.time.LocalTime;
import java.util.List;

import org.busondan.busondan.entity.SubwayTimetable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SubwayTimetableRepository extends JpaRepository<SubwayTimetable, Long> {
@Query(value = """
        SELECT * FROM subway_timetable
        WHERE 
            day_count >= (
                SELECT day_count FROM subway_timetable
                WHERE arrival_time >= :baseTime
                AND day_of_week = :dayOfWeek
                AND updn_line = :updnLine
                ORDER BY day_count
                LIMIT 1
            )
        AND day_of_week = :dayOfWeek
        AND updn_line = :updnLine
        """, nativeQuery = true)
    List<SubwayTimetable> findTimetableUsingDynamicDayCount(
        @Param("baseTime") LocalTime baseTime,
        @Param("dayOfWeek") String dayOfWeek,
        @Param("updnLine") String updnLine
    );
}
