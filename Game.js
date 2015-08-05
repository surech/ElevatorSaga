{
    /**
     * Dritte Version für mehrere Aufzüge. Ein zentraler Controller verteilt die Anfragen aus
     * den Stockwerken auf die einzelnen Lift nach einem einfachen Round-Robin-Verfahren
     */

    init: function(elevators, floors) {
        for(var e = 0; e < elevators.length; e++) {
            var elevator = elevators[e];

            // Dem Lift einen Namen geben
            elevator.name = "Elevator " + e;

            // Richtung, in welche der Lift fährt
            elevator.direction = "down";

            // Liste mit den Stockwerken, bei welchen von aussen ein Halt gewünscht wurde und Leute
            // einsteigen wollen. Wir müssen uns zudem merken, in welche Richtung die Leute
            // fahren wollen
            elevator.rideRequest = {};

            elevator.on("passing_floor", function (floorNum, direction) {
                console.log("Passing Floor: " + floorNum);
                // Wir überprüfen, ob wir bei diesem Stock anhalten sollen.
                if(isElevatorButtonPressed(this, floorNum) || isStopRequested(this, floorNum, this.direction)){
                    this.goToFloor(floorNum, true);
                }
            });

            elevator.on("floor_button_pressed", function (floor) {
                // Jemand hat den Knopf im Lift gedrückt.
                checkFinalDestination(floor, this);
            });

            elevator.on("stopped_at_floor", function (floorNum) {
                console.log("Stopped at Floor " + floorNum);
                if(floorNum === 0) {
                    console.log("Parterre");
                }

                if(this.destinationQueue.length < 1) {
                    // Wenn keine weiteren Ziele definiert sind haben wir unsere Bestimmung erreicht. Aber hier geht es
                    // nur in die andere Richtung weiter
                    swapDirection(this);

                    // Der am weitesten entfernte Stock suchen, der jemand gewählt hat
                    var destination = searchNextFinalDestination(this);
                    if(destination >= 0) {
                        checkFinalDestination(destination, this);
                    }
                }

                // Anfragen für dieses Stockwerk zurücksetzen, weil wir diese nun hoffentlich beantwortet haben
                deleteRideRequest(this, floorNum, this.direction);
            });
        }

        for(var f = 0; f < floors.length; f++) {
            var floor = floors[f];

            floor.on("up_button_pressed", function () {
                handleRideQuest(this.floorNum(), "up");
            });

            floor.on("down_button_pressed", function () {
                handleRideQuest(this.floorNum(), "down");
            });
        }

        /**
         * Behandelt die Anfrage auf Mitfahrt in einem Stockwert. Diese Methode entscheidet,
         * welcher Lift die Anfrage behandeln dar.
         * @param floorNum Stockwerk, in welchem die Anfrage gestellt wurde
         * @param direction Gewünscht Fahrrichtung
         */
        var handleRideQuest = function(floorNum, direction) {
            // Den Lift ermitteln, welche den höchsten Wert ergibt
            var bestQuantifier = -1;
            var bestElevator = null;

            for(var e = 0; e < elevators.length; e++) {
                var elevator = elevators[e];
                var quantifier = calculateQuantifier(elevator, floorNum, direction);

                if(quantifier > bestQuantifier) {
                    bestQuantifier = quantifier;
                    bestElevator = elevator;
                }
            }

            // Dem entsprechenden Lift den Auftrag geben
            addRideRequest(bestElevator, floorNum, direction);
        };

        var addRideRequest = function(elevator, floor, direction) {
            if(!elevator.rideRequest[floor]){
                elevator.rideRequest[floor] = {};
            }
            elevator.rideRequest[floor][direction] = true;

            checkFinalDestination(floor, elevator);
        };

        var deleteRideRequest = function(elevator, floor, direction) {
            if(elevator.rideRequest[floor] && elevator.rideRequest[floor][direction]) {
                elevator.rideRequest[floor][direction] = false;
            }
        };

        /**
         * Ermittelt den nächsten Bestimmungsort eines Liftes abhängig von seiner Richtung
         * @param elevator Lift
         * @param direction Richtung, in welche überprüft werden soll. Wenn dieser Parameter nicht übergeben wird,
         * wird die Richtung des Liftes übernommen
         * @returns {number} Neuer Bestimmungsort. -1, wenn kein Bestimmungsort ermittelt werden konnte.
         */
        var searchNextFinalDestination = function(elevator, direction) {
            if(direction === "undefined"){
                direction = elevator.direction;
            }

            var result = -1;

            // Je nach Richtung müssen wir unterschiedlich suchen
            if(direction === "up") {
                for(var f = elevator.currentFloor()+1; f < floors.length; f++) {
                    if(isElevatorButtonPressed(elevator, f) || isStopRequested(elevator, f, "down")) {
                        result = f;
                    }
                    // Wir fahren nach oben. Wenn jemand noch höher will, nehmen wir als Ziel gleich
                    // den darüberliegenden Stock
                    if(isStopRequested(elevator, f, "up")) {
                        result = f+1;
                    }
                }
            } else {
                for(var f = elevator.currentFloor()-1; f >= 0; f--) {
                    if(isElevatorButtonPressed(elevator, f) || isStopRequested(elevator, f, "up")) {
                        result = f;
                    }
                    // Wir fahren nach unten. Wenn jemand noch tiefer will, nehmen wir als Ziel gleich
                    // den darunterliegenden Stock
                    if(isStopRequested(elevator, f, "down")) {
                        result = f-1;
                    }
                }
            }

            return result;
        };

        /**
         * Überprüft, ob im Lift jemand einen bestimmten Stock gewünscht hat
         * @param elevator Lift
         * @param floor Soll bei diesem Stock angehalten werden?
         * @returns {boolean}
         */
        var isElevatorButtonPressed = function(elevator, floor) {
            var pressedFloors = elevator.getPressedFloors();
            for(var f = 0; f < pressedFloors.length; f++) {
                if(pressedFloors[f] === floor) {
                    return true;
                }
            }
            return false;
        };

        /**
         * Überprüft, ob jemand in einem Stockwerk in eine bestimmte Richtung mitfahren will.
         * @param elevator Lift
         * @param floor Zu überprüfendes Stockwerk
         * @param direction Zu überprüfende Richtung
         */
        var isStopRequested = function(elevator, floor, direction) {
            return elevator.rideRequest[floor] && elevator.rideRequest[floor][direction];
        };

        /**
         * Jeder Lift hat eine Zieldestination. Wenn jemand drückt müssen wir überprüfen,
         * ob dieser Stock weiter weg liegt als bis jetzt geplant. Wenn ja, passen wir
         * die Zieldestination an
         * @param destination Gewünschte Stock
         * @param elevator Lift
         */
        var checkFinalDestination = function(destination, elevator) {
            // Wenn der Lift stillsteht, gehen wir sofort zum gewünschten Stock
            if (elevator.destinationQueue.length < 1) {
                if(destination > elevator.currentFloor()){
                    elevator.direction = "up";
                } else if(destination < elevator.currentFloor()) {
                    elevator.direction = "down";
                }

                elevator.goToFloor(destination);
            } else {
                if(elevator.direction === "up" && destination > elevator.destinationQueue[0]){
                    elevator.destinationQueue = [];
                    elevator.destinationQueue[0] = destination;
                    elevator.checkDestinationQueue();
                }
                if(elevator.direction === "down" && destination < elevator.destinationQueue[0]){
                    elevator.destinationQueue = [];
                    elevator.destinationQueue[0] = destination;
                    elevator.checkDestinationQueue();
                }
            }

            updateDirectionIndicator(elevator);
        };

        var updateDirectionIndicator = function (elevator) {
            elevator.goingUpIndicator(elevator.direction === "up");
            elevator.goingDownIndicator(elevator.direction === "down");
        };

        /**
         * Ändert die Richtung eines Liftes
         * @param elevator Lift
         */
        var swapDirection = function(elevator) {
            if(elevator.direction === "up") {
                elevator.direction = "down";
            } else {
                elevator.direction = "up";
            }

            // Anzeige aktualisieren
            updateDirectionIndicator(elevator);
        };

        var calculateQuantifier = function(elevator, floor, direction) {
            // Kennzahlen ermitteln
            var loadFactorQuantifier = getLoadFactorQuantifier(elevator, floor, direction);
            var wayQuantifier = getWayQuantifier(elevator, floor, direction);
            var randomQuantifier = getRandomQuantifier(elevator, floor, direction);

            console.log("Quantifier for " + elevator.name);
            console.log("Load Factor: " + loadFactorQuantifier);
            console.log("Way: " + wayQuantifier);
            console.log("Random: " + randomQuantifier);

            var result =
                1.9 * loadFactorQuantifier +
                1.0 * wayQuantifier +
                0.01 * randomQuantifier;

            console.log("Result: " + result);

            return result;
        };

        var getLoadFactorQuantifier = function(elevator, floor, direction) {
            // Wert auslesen
            var loadFactor = elevator.loadFactor();

            // 1 bedeutet voll, 0 bedeutet leer. Wir wollen es aber gerade umgekehrt
            return 1- loadFactor;
        };

        var getWayQuantifier = function(elevator, floor, direction) {
            // Weg zum Ziel berechnen
            var way = calculateWayToFloor(elevator, floor, direction);

            // Der maximale Weg entspricht der doppelten Anzahl Stockwerke
            var maxWay = floors.length * 2;

            // Umrechnen, damit wir zu folgender Aussage kommen:
            // 1: sehr kurzer Weg
            // 0: sehr langer Weg
            var result = 1 - (way / maxWay);
            if(result > 1) {
                console.log("zu gross");
            }
            return result;
        };

        var getRandomQuantifier = function(elevator, floor, direction) {
            return Math.random();
        };

        var calculateWayToFloor = function(elevator, floor, direction) {
            // Sonderfall: Der Lift befindet sich bereits auf dem richtigen Stock, jedoch mit einer anderen
            // Zielrichtung. Wenn der Lift aber keine Destination hat, dann ist die Strecke 0
            if(elevator.currentFloor() === floor && elevator.destinationQueue.length < 1) {
                return 0;
            }

            // 1. Fall: Der Benutzer will in die gleiche Richtung und das Stockwerk liegt noch vor uns
            if(elevator.direction === "up" && direction === "up" && floor >= elevator.currentFloor()) {
                return floor - elevator.currentFloor();
            }
            if(elevator.direction === "down" && direction === "down" && floor <= elevator.currentFloor()) {
                return elevator.currentFloor() - floor;
            }

            // 2. Fall: Der Benutzer will in eine andere Richtung. Ob das Stockwerk vor oder hinter uns liegt spielt keine Rolle
            if(elevator.direction === "up" && direction === "down") {
                // Bestimmen, wie weit wir noch fahren
                var destination = Math.max(getFinalDestination(elevator), floor);
                var wayUp = destination - elevator.currentFloor();
                var wayDown = destination - floor;
                return wayUp + wayDown;
            }
            if(elevator.direction === "down" && direction === "up") {
                // Bestimmen, wie weit wir noch fahren
                var destination = Math.min(getFinalDestination(elevator), floor);
                var wayDown = elevator.currentFloor() - destination;
                var wayUp = floor - destination;
                return wayUp + wayDown;
            }

            // 3. Fall: Der Benutzer will in die gleiche Richtung, das Stockwerk liegt aber hinter uns
            if(elevator.direction === "up" && direction === "up" && floor < elevator.currentFloor()) {
                var destination = getFinalDestination(elevator);
                var otherDestination = Math.min(searchNextFinalDestination(elevator, "down"), floor);
                if(otherDestination < 0){
                    otherDestination = 0;
                }
                var wayUp = destination - elevator.currentFloor();
                var wayDown = destination - otherDestination;
                var wayUp2 = floor - otherDestination;
                return wayUp + wayDown + wayUp2;
            }
            if(elevator.direction === "down" && direction === "down" && floor > elevator.currentFloor()) {
                var destination = getFinalDestination(elevator);
                var otherDestination = Math.max(searchNextFinalDestination(elevator, "up"), floor);
                if(otherDestination < 0){
                    otherDestination = floors.length-1;
                }
                var wayDown = elevator.currentFloor() - destination;
                var wayUp = otherDestination - destination;
                var wayDown2 = otherDestination - floor;
                return wayDown + wayUp + wayDown2;
            }

            console.log("WTF! Floor: " + floor + ", Direction: " + direction + "\nCurrent Floor: " + elevator.currentFloor() + ", Elevator Direction: " + elevator.direction);
        };

        var getFinalDestination = function(elevator) {
            if(elevator.destinationQueue.length > 0) {
                return elevator.destinationQueue[0];
            } else {
                return elevator.currentFloor();
            }
        };

    },
    update: function(dt, elevators, floors) {
        // We normally don't need to do anything here
    }
}