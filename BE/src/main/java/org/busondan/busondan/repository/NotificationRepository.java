package org.busondan.busondan.repository;

import org.busondan.busondan.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {    
}
