package org.busondan.busondan.dto;

import lombok.Getter;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class BusTimeTableDto {
    String stationName;
    String routeId;
    String direction;
    String dayOfWeek;
    Integer dayCount;
    java.time.LocalTime averageTime;
    java.time.LocalTime firstBusTime;
    java.time.LocalTime lastBusTime;
}
