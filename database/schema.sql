-- ============================================================================
-- Smart Local Bus Route Finder  -  Database Schema (PostgreSQL / Neon)
-- Database Systems Final Semester Project
-- Group: Abdul Rafay (2412182), Varun Sainani (2412222)
-- SZABIST University, Karachi  -  BSCS
--
-- 21 tables (minimum required: 16). Every table has a primary key.
-- Foreign keys, relationships, and check constraints are defined throughout.
-- ============================================================================

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- ----------------------------------------------------------------------------
-- SECTION A: TRANSIT NETWORK (the routable graph)
-- ----------------------------------------------------------------------------

-- 1. zone  -  geographic / fare zones of Karachi
CREATE TABLE zone (
    zone_id      SERIAL PRIMARY KEY,
    name         VARCHAR(80)  NOT NULL UNIQUE,
    code         VARCHAR(10)  NOT NULL UNIQUE,
    description  TEXT
);

-- 2. operator  -  bus operators running services in the city
CREATE TABLE operator (
    operator_id      SERIAL PRIMARY KEY,
    name             VARCHAR(120) NOT NULL UNIQUE,
    short_name       VARCHAR(40),
    operator_type    VARCHAR(30)  NOT NULL DEFAULT 'Government'
                     CHECK (operator_type IN ('Government','Public-Private','Private')),
    contact_phone    VARCHAR(20),
    established_year INT CHECK (established_year BETWEEN 1900 AND 2100)
);

-- 3. route_type  -  category of service (BRT, Feeder, Electric, Intercity)
CREATE TABLE route_type (
    route_type_id SERIAL PRIMARY KEY,
    name          VARCHAR(40) NOT NULL UNIQUE,
    color_hex     VARCHAR(7)  NOT NULL DEFAULT '#1976d2'
                  CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
    base_fare     NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (base_fare >= 0),
    description   TEXT
);

-- 4. route  -  a named bus service
CREATE TABLE route (
    route_id      SERIAL PRIMARY KEY,
    code          VARCHAR(20) NOT NULL UNIQUE,
    name          VARCHAR(120) NOT NULL,
    route_type_id INT NOT NULL REFERENCES route_type(route_type_id),
    operator_id   INT NOT NULL REFERENCES operator(operator_id),
    length_km     NUMERIC(6,2) CHECK (length_km >= 0),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    launch_date   DATE
);

-- 5. stop  -  a physical bus stop / BRT station
CREATE TABLE stop (
    stop_id     SERIAL PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    zone_id     INT REFERENCES zone(zone_id),
    latitude    NUMERIC(9,6) NOT NULL CHECK (latitude  BETWEEN -90  AND 90),
    longitude   NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
    has_shelter BOOLEAN NOT NULL DEFAULT TRUE
);

-- 6. route_stop  -  ordered stops on a route. Each consecutive pair is a graph edge.
CREATE TABLE route_stop (
    route_stop_id        SERIAL PRIMARY KEY,
    route_id             INT NOT NULL REFERENCES route(route_id) ON DELETE CASCADE,
    stop_id              INT NOT NULL REFERENCES stop(stop_id),
    stop_sequence        INT NOT NULL CHECK (stop_sequence >= 1),
    distance_from_prev_km NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (distance_from_prev_km >= 0),
    time_from_prev_min    INT NOT NULL DEFAULT 0 CHECK (time_from_prev_min >= 0),
    fare_from_prev        NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (fare_from_prev >= 0),
    UNIQUE (route_id, stop_sequence),
    UNIQUE (route_id, stop_id)
);

-- 7. fare_stage  -  distance band fare rules per route type
CREATE TABLE fare_stage (
    fare_stage_id   SERIAL PRIMARY KEY,
    route_type_id   INT NOT NULL REFERENCES route_type(route_type_id) ON DELETE CASCADE,
    max_distance_km NUMERIC(6,2) NOT NULL CHECK (max_distance_km > 0),
    fare            NUMERIC(6,2) NOT NULL CHECK (fare >= 0),
    UNIQUE (route_type_id, max_distance_km)
);

-- ----------------------------------------------------------------------------
-- SECTION B: FLEET & OPERATIONS
-- ----------------------------------------------------------------------------

-- 8. bus_model  -  vehicle model specification
CREATE TABLE bus_model (
    bus_model_id     SERIAL PRIMARY KEY,
    manufacturer     VARCHAR(60) NOT NULL,
    model_name       VARCHAR(60) NOT NULL,
    seating_capacity INT NOT NULL CHECK (seating_capacity > 0),
    standing_capacity INT NOT NULL DEFAULT 0 CHECK (standing_capacity >= 0),
    fuel_type        VARCHAR(20) NOT NULL
                     CHECK (fuel_type IN ('Diesel','CNG','Hybrid','Electric')),
    UNIQUE (manufacturer, model_name)
);

-- 9. bus  -  a physical fleet vehicle
CREATE TABLE bus (
    bus_id          SERIAL PRIMARY KEY,
    registration_no VARCHAR(20) NOT NULL UNIQUE,
    bus_model_id    INT NOT NULL REFERENCES bus_model(bus_model_id),
    operator_id     INT NOT NULL REFERENCES operator(operator_id),
    route_id        INT REFERENCES route(route_id) ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'Active'
                    CHECK (status IN ('Active','Maintenance','Retired')),
    in_service_date DATE,
    odometer_km     INT NOT NULL DEFAULT 0 CHECK (odometer_km >= 0)
);

-- 10. driver
CREATE TABLE driver (
    driver_id   SERIAL PRIMARY KEY,
    full_name   VARCHAR(120) NOT NULL,
    license_no  VARCHAR(30) NOT NULL UNIQUE,
    operator_id INT NOT NULL REFERENCES operator(operator_id),
    phone       VARCHAR(20),
    hire_date   DATE,
    shift       VARCHAR(20) CHECK (shift IN ('Morning','Evening','Night'))
);

-- 11. staff  -  station based staff
CREATE TABLE staff (
    staff_id    SERIAL PRIMARY KEY,
    full_name   VARCHAR(120) NOT NULL,
    role        VARCHAR(40) NOT NULL
                CHECK (role IN ('Station Manager','Ticketing','Security','Cleaning','Maintenance')),
    stop_id     INT REFERENCES stop(stop_id) ON DELETE SET NULL,
    operator_id INT NOT NULL REFERENCES operator(operator_id),
    hire_date   DATE
);

-- 12. schedule  -  a scheduled trip on a route
CREATE TABLE schedule (
    schedule_id    SERIAL PRIMARY KEY,
    route_id       INT NOT NULL REFERENCES route(route_id) ON DELETE CASCADE,
    bus_id         INT REFERENCES bus(bus_id) ON DELETE SET NULL,
    driver_id      INT REFERENCES driver(driver_id) ON DELETE SET NULL,
    departure_time TIME NOT NULL,
    direction      VARCHAR(20) NOT NULL DEFAULT 'Outbound'
                   CHECK (direction IN ('Inbound','Outbound')),
    day_type       VARCHAR(20) NOT NULL DEFAULT 'Weekday'
                   CHECK (day_type IN ('Weekday','Weekend','Daily'))
);

-- 13. trip_log  -  a completed trip (operational analytics source)
CREATE TABLE trip_log (
    trip_log_id      SERIAL PRIMARY KEY,
    schedule_id      INT NOT NULL REFERENCES schedule(schedule_id) ON DELETE CASCADE,
    service_date     DATE NOT NULL,
    actual_departure TIMESTAMP,
    actual_arrival   TIMESTAMP,
    passenger_count  INT NOT NULL DEFAULT 0 CHECK (passenger_count >= 0),
    on_time          BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (schedule_id, service_date)
);

-- 14. maintenance  -  vehicle maintenance record
CREATE TABLE maintenance (
    maintenance_id   SERIAL PRIMARY KEY,
    bus_id           INT NOT NULL REFERENCES bus(bus_id) ON DELETE CASCADE,
    maintenance_date DATE NOT NULL,
    maintenance_type VARCHAR(40) NOT NULL
                     CHECK (maintenance_type IN ('Routine','Repair','Inspection','Tyre','Engine','Electrical')),
    cost             NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
    notes            TEXT
);

-- ----------------------------------------------------------------------------
-- SECTION C: PASSENGERS, TICKETING & REVENUE
-- ----------------------------------------------------------------------------

-- 15. passenger  -  registered app user / commuter
CREATE TABLE passenger (
    passenger_id SERIAL PRIMARY KEY,
    full_name    VARCHAR(120) NOT NULL,
    email        VARCHAR(120) UNIQUE,
    phone        VARCHAR(20),
    home_zone_id INT REFERENCES zone(zone_id) ON DELETE SET NULL,
    signup_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    gender       VARCHAR(10) CHECK (gender IN ('Male','Female','Other'))
);

-- 16. fare_card  -  a stored value transit card
CREATE TABLE fare_card (
    fare_card_id SERIAL PRIMARY KEY,
    card_number  VARCHAR(20) NOT NULL UNIQUE,
    passenger_id INT NOT NULL REFERENCES passenger(passenger_id) ON DELETE CASCADE,
    balance      NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    issued_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    status       VARCHAR(20) NOT NULL DEFAULT 'Active'
                 CHECK (status IN ('Active','Blocked','Expired'))
);

-- 17. card_transaction  -  top ups, refunds and fare deductions
CREATE TABLE card_transaction (
    transaction_id SERIAL PRIMARY KEY,
    fare_card_id   INT NOT NULL REFERENCES fare_card(fare_card_id) ON DELETE CASCADE,
    amount         NUMERIC(8,2) NOT NULL CHECK (amount <> 0),
    txn_type       VARCHAR(20) NOT NULL
                   CHECK (txn_type IN ('TopUp','Refund','Fare')),
    payment_method VARCHAR(20)
                   CHECK (payment_method IN ('Cash','Card','EasyPaisa','JazzCash','BankApp')),
    txn_time       TIMESTAMP NOT NULL DEFAULT now()
);

-- 18. journey  -  an actual passenger trip (the main analytics fact table)
CREATE TABLE journey (
    journey_id    SERIAL PRIMARY KEY,
    passenger_id  INT NOT NULL REFERENCES passenger(passenger_id) ON DELETE CASCADE,
    fare_card_id  INT REFERENCES fare_card(fare_card_id) ON DELETE SET NULL,
    route_id      INT NOT NULL REFERENCES route(route_id),
    board_stop_id  INT NOT NULL REFERENCES stop(stop_id),
    alight_stop_id INT NOT NULL REFERENCES stop(stop_id),
    board_time    TIMESTAMP NOT NULL,
    alight_time   TIMESTAMP,
    fare          NUMERIC(6,2) NOT NULL CHECK (fare >= 0),
    num_stops     INT NOT NULL DEFAULT 0 CHECK (num_stops >= 0),
    transfers     INT NOT NULL DEFAULT 0 CHECK (transfers >= 0),
    CHECK (alight_stop_id <> board_stop_id)
);

-- 19. route_search  -  a logged in-app route lookup (powers popular OD analytics)
CREATE TABLE route_search (
    search_id            SERIAL PRIMARY KEY,
    passenger_id         INT REFERENCES passenger(passenger_id) ON DELETE SET NULL,
    from_stop_id         INT REFERENCES stop(stop_id),
    to_stop_id           INT REFERENCES stop(stop_id),
    searched_at          TIMESTAMP NOT NULL DEFAULT now(),
    result_found         BOOLEAN NOT NULL DEFAULT TRUE,
    recommended_route_id INT REFERENCES route(route_id) ON DELETE SET NULL
);

-- 20. feedback  -  passenger rating / complaint
CREATE TABLE feedback (
    feedback_id  SERIAL PRIMARY KEY,
    passenger_id INT NOT NULL REFERENCES passenger(passenger_id) ON DELETE CASCADE,
    route_id     INT REFERENCES route(route_id) ON DELETE SET NULL,
    journey_id   INT REFERENCES journey(journey_id) ON DELETE SET NULL,
    rating       INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    category     VARCHAR(30)
                 CHECK (category IN ('Cleanliness','Punctuality','Driver','Safety','Crowding','App','Other')),
    comment      TEXT,
    created_at   TIMESTAMP NOT NULL DEFAULT now()
);

-- 21. incident  -  a service incident or disruption
CREATE TABLE incident (
    incident_id   SERIAL PRIMARY KEY,
    route_id      INT REFERENCES route(route_id) ON DELETE SET NULL,
    stop_id       INT REFERENCES stop(stop_id) ON DELETE SET NULL,
    incident_type VARCHAR(40) NOT NULL
                  CHECK (incident_type IN ('Breakdown','Accident','Delay','Overcrowding','Weather','Protest','Other')),
    severity      VARCHAR(20) NOT NULL
                  CHECK (severity IN ('Low','Medium','High','Critical')),
    reported_at   TIMESTAMP NOT NULL DEFAULT now(),
    resolved_at   TIMESTAMP,
    description   TEXT
);

-- ----------------------------------------------------------------------------
-- INDEXES (support the routing engine and the analytical queries)
-- ----------------------------------------------------------------------------
CREATE INDEX idx_route_stop_route    ON route_stop(route_id);
CREATE INDEX idx_route_stop_stop     ON route_stop(stop_id);
CREATE INDEX idx_journey_route       ON journey(route_id);
CREATE INDEX idx_journey_board_time  ON journey(board_time);
CREATE INDEX idx_journey_board_stop  ON journey(board_stop_id);
CREATE INDEX idx_txn_card            ON card_transaction(fare_card_id);
CREATE INDEX idx_txn_time            ON card_transaction(txn_time);
CREATE INDEX idx_trip_log_date       ON trip_log(service_date);
CREATE INDEX idx_route_search_time   ON route_search(searched_at);
CREATE INDEX idx_feedback_route      ON feedback(route_id);
CREATE INDEX idx_bus_route           ON bus(route_id);
CREATE INDEX idx_schedule_route      ON schedule(route_id);
