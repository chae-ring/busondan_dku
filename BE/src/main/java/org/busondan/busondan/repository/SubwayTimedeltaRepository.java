package org.busondan.busondan.repository;

import java.util.Optional;

import org.busondan.busondan.entity.SubwayTimedelta;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubwayTimedeltaRepository extends JpaRepository<SubwayTimedelta, Long> {
    public Optional<SubwayTimedelta> findByUpdnLineAndDeltaAndStationName(String updnLine, String delta, String stationName);
}
