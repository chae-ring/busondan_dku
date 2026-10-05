package org.busondan.busondan.dto;
import java.time.LocalTime;

import lombok.Getter;

@Getter
public class PredictedBusArrivalDto {

    private final String direction;
    private final int dayCount;
    private final LocalTime predictedTime;

    public PredictedBusArrivalDto(String direction, int dayCount, LocalTime predictedTime) {
        this.direction = direction;
        this.dayCount = dayCount;
        this.predictedTime = predictedTime;
    }
}