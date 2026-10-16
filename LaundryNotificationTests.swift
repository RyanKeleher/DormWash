import XCTest

func checkCycleStatus(machineID: Int, status: String) -> Bool {
    return machineID > 0 && status == "Done"
}

final class TestLaundryNotification: XCTestCase {

    func testValidDone() {
        XCTAssertTrue(checkCycleStatus(machineID: 123, status: "Done"))
    }
}
