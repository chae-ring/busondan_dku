package org.busondan.busondan.controller;

import lombok.RequiredArgsConstructor;
import org.busondan.busondan.service.BusDataService;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;


@RestController
@RequiredArgsConstructor
public class BusController {

    private final BusDataService busDataService;

    @GetMapping(value = "/bus_info", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getBusInfo() {
        String busDataJson = busDataService.getCombinedBusInfo();
        if (busDataJson != null) {
            return ResponseEntity.ok(busDataJson);
        } else {
            return ResponseEntity.status(500).body("{\"error\": \"Bus data is currently being prepared.\"}");
        }
    }

    @GetMapping(value = "/buses/stations/{stationId}/timetable", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getStationBusTimetable(@PathVariable String stationId, @RequestParam(required = true) String routeId) {
        String timetableJson = busDataService.getBusTimetable(stationId, routeId);
        if (timetableJson != null) {
            return ResponseEntity.ok(timetableJson);
        } else {
            return ResponseEntity.status(500).body("{\"error\": \"Timetable data not found for the specified station.\"}");
        }
    }
}