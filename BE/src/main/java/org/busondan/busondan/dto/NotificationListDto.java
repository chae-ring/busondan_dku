package org.busondan.busondan.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public class NotificationListDto {

    List<NotificationDto> notifications;

    @AllArgsConstructor
    @Getter
    public static class NotificationDto {
        private Long id;
        private String title;
        private String message;
        private String linkUrl;
        private String author;
        private String createdAt;
    }
}
