package org.busondan.busondan.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class NotificationStatusDto {
    private boolean hasNotifications;
    private int notificationCount;
}
