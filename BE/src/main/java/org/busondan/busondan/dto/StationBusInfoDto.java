package org.busondan.busondan.dto;

import java.util.List;

public record StationBusInfoDto(
    String stationName,
    List<BusArrivalDto> busList
) {}