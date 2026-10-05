package org.busondan.busondan.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "bus_timetable")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class BusTimetable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDateTime arrivalTime;
    private String dayOfWeek;
    private String routeName;
    private String stationName;
    private String plateNo;
    private String delta;
    private Long dayCount;

    public BusTimetable(LocalDateTime arrivalTime, String dayOfWeek, String routeName, String stationName, String plateNo, String delta, Long dayCount) {
        this.arrivalTime = arrivalTime;
        this.dayOfWeek = dayOfWeek;
        this.routeName = routeName;
        this.stationName = stationName;
        this.plateNo = plateNo;
        this.delta = delta;
        this.dayCount = dayCount;
    }
}