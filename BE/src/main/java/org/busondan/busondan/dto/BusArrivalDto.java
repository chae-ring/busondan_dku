package org.busondan.busondan.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record BusArrivalDto(
    String routeName,
    String direction,
    String firstRemainingTime,
    String secondRemainingTime,
    String type
) {}
