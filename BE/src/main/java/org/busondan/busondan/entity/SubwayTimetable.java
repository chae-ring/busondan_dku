package org.busondan.busondan.entity;

import java.time.LocalTime;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "subway_timetable")
public class SubwayTimetable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String updnLine;
    private LocalTime arrivalTime;
    private String trainNo;
    private String dayOfWeek;
    private String firstStation;
    private String lastStation;
    private Long dayCount;
    private Boolean lastTrain;
    private Boolean firstTrain;
}
