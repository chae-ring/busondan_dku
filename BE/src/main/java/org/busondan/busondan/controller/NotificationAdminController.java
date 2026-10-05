package org.busondan.busondan.controller;

import java.time.LocalDate;

import org.busondan.busondan.entity.Notification;
import org.busondan.busondan.repository.NotificationRepository;
import org.busondan.busondan.service.NotificationService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import lombok.RequiredArgsConstructor;

@Controller
@RequestMapping("/notifications/admin")
@RequiredArgsConstructor
public class NotificationAdminController {
    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;

    @GetMapping
    public String getAdminPage(Model model) {
        model.addAttribute("notifications", notificationService.getAllNotifiaction().getNotifications());
        return "notification-admin"; // → templates/notification-admin.html
    }

    @PostMapping("/add")
    public String addNotification(
            @RequestParam String title,
            @RequestParam String message,
            @RequestParam String linkUrl,
            @RequestParam String author
    ) {
        Notification newNoti = new Notification();
        newNoti.setTitle(title);
        newNoti.setMessage(message);
        newNoti.setLinkUrl(linkUrl);
        newNoti.setAuthor(author);
        newNoti.setCreatedAt(LocalDate.now());
        notificationRepository.save(newNoti);
        return "redirect:/notifications/admin";
    }

    @PostMapping("/delete/{id}")
    public String deleteNotification(@PathVariable Long id) {
        notificationRepository.deleteById(id);
        return "redirect:/notifications/admin";
    }
}
