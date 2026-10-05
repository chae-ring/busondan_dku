package org.busondan.busondan.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "arrival_log")
@Getter
@Setter
@NoArgsConstructor
public class ArrivalLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDateTime arrivalTime;
    private String dayOfWeek;
    private String routeName;
    private String stationName;
    private String plateNo;
    private Long dayCount;

    public ArrivalLog(LocalDateTime arrivalTime, String dayOfWeek, String routeName, String stationName, String plateNo, Long dayCount) {
        this.arrivalTime = arrivalTime;
        this.dayOfWeek = dayOfWeek;
        this.routeName = routeName;
        this.stationName = stationName;
        this.plateNo = plateNo;
        this.dayCount = dayCount;
    }
}