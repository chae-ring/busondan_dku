package org.busondan.busondan.controller;

import org.busondan.busondan.dto.NotificationListDto;
import org.busondan.busondan.dto.NotificationStatusDto;
import org.busondan.busondan.service.NotificationService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;


@Controller
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

    @GetMapping(value = "/notifications", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<NotificationListDto> getAllNotification() {
        return ResponseEntity.ok(notificationService.getAllNotifiaction());
    }
    
    @GetMapping(value = "/notifications/status", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<NotificationStatusDto> getNotificationStatus() {
        return ResponseEntity.ok(notificationService.getNotificationStatus());
    }
}
