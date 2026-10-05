package org.busondan.busondan.service;

import org.busondan.busondan.dto.NotificationListDto;
import org.busondan.busondan.dto.NotificationStatusDto;
import org.busondan.busondan.repository.NotificationRepository;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationService {
    public final NotificationRepository notificationRepository;


    public NotificationListDto getAllNotifiaction() {
        var notifications = notificationRepository.findAll().stream().map(notification -> 
            new NotificationListDto.NotificationDto(
                notification.getId(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getLinkUrl(),
                notification.getAuthor(),
                notification.getCreatedAt().toString()
            )
        ).toList();

        return new NotificationListDto(notifications);
    }

    public NotificationStatusDto getNotificationStatus() {
        boolean hasNotifications = notificationRepository.count() > 0;
        int notificationCount = (int) notificationRepository.count();

        return new NotificationStatusDto(hasNotifications, notificationCount);
    }
}
