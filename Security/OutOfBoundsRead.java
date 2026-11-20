import java.util.Arrays;
import java.util.Optional;

/**
 * CWE-125: Out-of-bounds Read -- DormWash dryer reservations.
 *
 * In the app, a student picks a dryer number (1..N) and an hour slot (0..23).
 * Those numbers come from the client, so they cannot be trusted. Reading
 * dryers[number] or reservations[dryer][hour] without checking can read
 * outside the array. In C that leaks memory. In Java it throws
 * ArrayIndexOutOfBoundsException, which can crash the booking request
 * (denial of service). Off-by-one math can also return the WRONG dryer's data.
 *
 * Mitigation: check every index against the real array length before reading.
 * Convert 1-based dryer numbers to 0-based indexes in one place only. Never
 * trust a count or length the client sends.
 */
public class OutOfBoundsRead {

    public enum Status { FREE, RUNNING, DONE, OUT_OF_ORDER }

    private static final int HOURS_PER_DAY = 24;

    private final Status[] dryers;
    private final String[][] reservations; // [dryer][hour] -> student ID or null

    public OutOfBoundsRead(int dryerCount) {
        if (dryerCount <= 0) {
            throw new IllegalArgumentException("dryerCount must be positive");
        }
        dryers = new Status[dryerCount];
        Arrays.fill(dryers, Status.FREE);
        reservations = new String[dryerCount][HOURS_PER_DAY];
    }

    // ===================== VULNERABLE (for comparison only) =====================

    /** BAD: trusts the client's number and forgets the 1-based to 0-based shift. */
    public Status getStatusUnsafe(int dryerNumber) {
        return dryers[dryerNumber]; // "Dryer 0", "-1", or the last dryer reads out of bounds
    }

    /** BAD: uses <= so the loop reads one element past the end. */
    public int countFreeUnsafe() {
        int free = 0;
        for (int i = 0; i <= dryers.length; i++) {
            if (dryers[i] == Status.FREE) free++;
        }
        return free;
    }

    // ============================== SAFE VERSIONS ===============================

    private boolean isValidDryer(int dryerNumber) {
        return dryerNumber >= 1 && dryerNumber <= dryers.length;
    }

    private static boolean isValidHour(int hour) {
        return hour >= 0 && hour < HOURS_PER_DAY;
    }

    /** GOOD: checks the bounds and returns empty for a dryer that does not exist. */
    public Optional<Status> getStatus(int dryerNumber) {
        if (!isValidDryer(dryerNumber)) return Optional.empty();
        return Optional.of(dryers[dryerNumber - 1]);
    }

    /** GOOD: checks both indexes before reading the 2-D reservation table. */
    public Optional<String> getReservation(int dryerNumber, int hour) {
        if (!isValidDryer(dryerNumber) || !isValidHour(hour)) return Optional.empty();
        return Optional.ofNullable(reservations[dryerNumber - 1][hour]);
    }

    /** GOOD: a for-each loop cannot step past the end of the array. */
    public int countFree() {
        int free = 0;
        for (Status s : dryers) {
            if (s == Status.FREE) free++;
        }
        return free;
    }

    /**
     * GOOD: the client asks for "the next N hours". N is clamped so the read
     * never goes past hour 23 (and a huge N cannot overflow the math).
     */
    public String[] getSchedule(int dryerNumber, int startHour, int hours) {
        if (!isValidDryer(dryerNumber) || !isValidHour(startHour) || hours <= 0) {
            return new String[0];
        }
        int count = Math.min(hours, HOURS_PER_DAY - startHour);
        return Arrays.copyOfRange(reservations[dryerNumber - 1], startHour, startHour + count);
    }

    /** Books a slot only after the same bounds checks. */
    public boolean book(int dryerNumber, int hour, String studentId) {
        if (!isValidDryer(dryerNumber) || !isValidHour(hour) || studentId == null) return false;
        if (reservations[dryerNumber - 1][hour] != null) return false; // already taken
        reservations[dryerNumber - 1][hour] = studentId;
        return true;
    }

    // ================================== DEMO ====================================

    public static void main(String[] args) {
        OutOfBoundsRead laundry = new OutOfBoundsRead(4); // dryers 1-4
        laundry.book(2, 18, "rkeleher");

        System.out.println("Dryer 2 status: " + laundry.getStatus(2).orElse(null));
        System.out.println("Dryer 99 status: " + laundry.getStatus(99).map(Enum::name).orElse("invalid dryer"));
        System.out.println("Dryer 2 @ 18:00: " + laundry.getReservation(2, 18).orElse("open"));
        System.out.println("Dryer 2 @ 25:00: " + laundry.getReservation(2, 25).orElse("invalid hour"));
        System.out.println("Next 100 hours from 22:00: " + laundry.getSchedule(2, 22, 100).length + " slots");
        System.out.println("Free dryers: " + laundry.countFree());

        try {
            laundry.getStatusUnsafe(4); // last dryer, but no -1 shift
        } catch (ArrayIndexOutOfBoundsException e) {
            System.out.println("Unsafe read crashed: " + e.getMessage());
        }
    }
}
