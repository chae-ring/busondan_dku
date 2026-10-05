package org.busondan.busondan.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Setter
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class SubwayArrivalDto {
    String updnLine;
    List <SubwayArrivalInfo> arrivalInfoList;

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class SubwayArrivalInfo {
        String updnLine;
        String endStationName;
        String startStationName;
        String trainNo;
        String currentStation;
        String remainingTime;
        Boolean lastTrain; 
        Integer arvlCode;
        String type;
    }
}
