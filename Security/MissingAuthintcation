import java.util.HashMap;
import java.util.Map;

/**
 * DormWash Security Demonstration: CWE-306 (Missing Authentication for Critical Function)
 *
 * Demonstrates how exposing critical laundry machine controls (starting/stopping cycles,
 * canceling reservations) without authentication allows unauthorized users to disrupt
 * other residents' laundry sessions, and how to mitigate it.
 */
public class MissingAuthentication {

    // Simulated machine database: Machine ID -> Current User ID (null if available)
    private static final Map<String, String> machineStatus = new HashMap<>();

    // Simulated active session tokens (e.g., verified Supabase JWTs): Token -> User ID
    private static final Map<String, String> validTokens = new HashMap<>();

    static {
        // Initialize DormWash machines
        machineStatus.put("WASHER-101", "student_jace");
        machineStatus.put("DRYER-202", null); // Available

        // Initialize valid authenticated sessions
        validTokens.put("jwt_valid_jace_123", "student_jace");
        validTokens.put("jwt_valid_alex_456", "student_alex");
    }

    // =========================================================================
    // VULNERABLE IMPLEMENTATION (CWE-306: Missing Authentication)
    // =========================================================================
    /**
     * FLAW: Any caller can stop a washer or cancel a reservation simply by knowing
     * the machineId. No session token or user identity is verified.
     */
    public static String cancelWasherVulnerable(String machineId) {
        if (!machineStatus.containsKey(machineId)) {
            return "Error: Machine not found.";
        }
        String previousUser = machineStatus.put(machineId, null);
        return "[VULNERABLE] " + machineId + " was forcibly canceled (was in use by: " + previousUser + ").";
    }

    // =========================================================================
    // SECURE IMPLEMENTATION (Mitigated CWE-306)
    // =========================================================================
    /**
     * FIX: Requires a valid authentication token before performing the critical
     * action, and verifies that the authenticated user owns the active cycle.
     */
    public static String cancelWasherSecure(String authToken, String machineId) {
        // 1. Authentication Check: Verify the caller has a valid session token
        if (authToken == null || !validTokens.containsKey(authToken)) {
            return "[BLOCKED - 401 Unauthorized] Missing or invalid authentication token.";
        }

        String authenticatedUser = validTokens.get(authToken);

        // 2. Resource Validation: Ensure the machine exists
        if (!machineStatus.containsKey(machineId)) {
            return "[ERROR - 404 Not Found] Machine " + machineId + " does not exist.";
        }

        String currentOwner = machineStatus.get(machineId);
        if (currentOwner == null) {
            return "[INFO] " + machineId + " is already available.";
        }

        // 3. Ownership Check: Prevent authenticated users from canceling someone else's laundry
        if (!currentOwner.equals(authenticatedUser)) {
            return "[BLOCKED - 403 Forbidden] User '" + authenticatedUser
                    + "' cannot cancel " + machineId + " (in use by '" + currentOwner + "').";
        }

        // 4. Execute Critical Function
        machineStatus.put(machineId, null);
        return "[SUCCESS - 200 OK] " + authenticatedUser + " successfully canceled " + machineId + ".";
    }

    public static void main(String[] args) {
        System.out.println("=== DormWash CWE-306 Demo ===\n");

        // 1. Attacker exploits CWE-306 without logging in
        System.out.println("1. Unauthenticated attacker calls vulnerable endpoint:");
        System.out.println("   " + cancelWasherVulnerable("WASHER-101"));

        // Reset machine state for secure demo
        machineStatus.put("WASHER-101", "student_jace");
        System.out.println("\n--- Resetting WASHER-101 to student_jace ---\n");

        // 2. Unauthenticated request against secure endpoint -> Blocked (401)
        System.out.println("2. Unauthenticated attacker calls secure endpoint:");
        System.out.println("   " + cancelWasherSecure(null, "WASHER-101"));

        // 3. Different authenticated user tries to cancel Jace's washer -> Blocked (403)
        System.out.println("3. Another logged-in resident tries to cancel Jace's washer:");
        System.out.println("   " + cancelWasherSecure("jwt_valid_alex_456", "WASHER-101"));

        // 4. Legitimate authenticated owner cancels their own washer -> Allowed (200)
        System.out.println("4. Authenticated owner cancels their own washer:");
        System.out.println("   " + cancelWasherSecure("jwt_valid_jace_123", "WASHER-101"));
    }
}
