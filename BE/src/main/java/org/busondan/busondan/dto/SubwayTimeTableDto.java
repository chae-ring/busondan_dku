package org.busondan.busondan.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class SubwayTimeTableDto {
    private String updnLine;
    private String stationName;
    private List<SubwayScheduleDto> dayofweek;
}