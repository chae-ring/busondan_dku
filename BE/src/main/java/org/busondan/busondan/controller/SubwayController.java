package org.busondan.busondan.controller;

import org.busondan.busondan.service.SubwayDataService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
public class SubwayController {
    private final SubwayDataService subwayDataService;

    @GetMapping(value = "/subway/arrivals", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getBusInfo() {
        String busDataJson = subwayDataService.getCombinedSubwayInfo();
        if (busDataJson != null) {
            return ResponseEntity.ok(busDataJson);
        } else {
            return ResponseEntity.status(500).body("{\"error\": \"Subway data is currently being prepared.\"}");
        }
    }

    @GetMapping(value = "/subway/timetable", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getSubwayTimetable(@RequestParam(required = true) String updnLine) {
        String timetableJson = subwayDataService.getSubwayTimetableInfo(updnLine);
        if (timetableJson != null) {
            return ResponseEntity.ok(timetableJson);
        } else {
            return ResponseEntity.status(500).body("{\"error\": \"Subway timetable data is currently being prepared.\"}");
        } 
    }
}
