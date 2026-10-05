package org.busondan.busondan.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class SubwayScheduleDto {
    private List<SubwaySchedule> timtables;
    private String name;

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SubwaySchedule {
        private String time;
        private String endStationName;
        private String startStation;
        private String trainNo;
        private Boolean firstTrain;
        private Boolean lastTrain;
        private Long dayCount;
    }
}