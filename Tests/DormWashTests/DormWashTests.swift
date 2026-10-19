import XCTest
@testable import DormWash

// MARK: - Maintenance request validation

final class ValidateRequestTests: XCTestCase {

    func testValidRequestPasses() {
        let request = MaintenanceRequest(machineID: "W4", issue: .wontStart, details: "")
        XCTAssertNil(validate(request))
    }

    func testEmptyMachineIDIsRejected() {
        let request = MaintenanceRequest(machineID: "   ", issue: .leaking, details: "")
        XCTAssertEqual(validate(request), .emptyMachineID)
    }

    func testMachineIDTooLongIsRejected() {
        let longID = String(repeating: "W", count: RequestRules.maxMachineIDLength + 1)
        let request = MaintenanceRequest(machineID: longID, issue: .leaking, details: "")
        XCTAssertEqual(validate(request), .machineIDTooLong)
    }

    func testOtherIssueNeedsDetails() {
        let request = MaintenanceRequest(machineID: "W4", issue: .other, details: "  ")
        XCTAssertEqual(validate(request), .missingDetails)
    }

    func testOtherIssueWithDetailsPasses() {
        let request = MaintenanceRequest(machineID: "W4", issue: .other, details: "Smells like smoke")
        XCTAssertNil(validate(request))
    }

    func testDetailsTooLongIsRejected() {
        let longDetails = String(repeating: "a", count: RequestRules.maxDetailsLength + 1)
        let request = MaintenanceRequest(machineID: "W4", issue: .leaking, details: longDetails)
        XCTAssertEqual(validate(request), .detailsTooLong)
    }

    func testEveryErrorHasAMessage() {
        let errors: [RequestError] = [.emptyMachineID, .machineIDTooLong, .missingDetails, .detailsTooLong]
        for error in errors {
            XCTAssertFalse(error.message.isEmpty, "\(error) has no message")
        }
    }
}

// MARK: - Sending requests

final class MaintenanceServiceTests: XCTestCase {

    func testValidRequestGoesToMaintenance() {
        let service = MaintenanceService()
        let sent = service.sendRequest(MaintenanceRequest(machineID: "W4", issue: .doorStuck, details: ""))
        XCTAssertTrue(sent)
        XCTAssertEqual(service.sent.count, 1)
        XCTAssertTrue(service.sentToDev.isEmpty)
    }

    func testToDevGoesToDeveloperInbox() {
        let service = MaintenanceService()
        service.sendRequest(MaintenanceRequest(machineID: "W4", issue: .doorStuck, details: ""), toDev: true)
        XCTAssertTrue(service.sent.isEmpty)
        XCTAssertEqual(service.sentToDev.count, 1)
    }

    func testInvalidRequestIsNotSent() {
        let service = MaintenanceService()
        let sent = service.sendRequest(MaintenanceRequest(machineID: "", issue: .leaking, details: ""))
        XCTAssertFalse(sent)
        XCTAssertTrue(service.sent.isEmpty)
        XCTAssertTrue(service.sentToDev.isEmpty)
    }

    func testSendRequestAlert() {
        XCTAssertTrue(sendRequestAlert("W4"))
        XCTAssertTrue(sendRequestAlert("W4", sendToDeveloper: true))
        XCTAssertFalse(sendRequestAlert(""))
    }
}

// MARK: - Laundry cycle and timers

final class LaundryCycleTests: XCTestCase {

    func testProgressHalfway() {
        let cycle = LaundryCycle(machineName: "Washer 3B", stage: .washing, totalDuration: 100, remaining: 50)
        XCTAssertEqual(cycle.progress, 0.5, accuracy: 0.0001)
    }

    func testProgressWithZeroDurationIsZero() {
        let cycle = LaundryCycle(machineName: "Washer 3B", stage: .washing, totalDuration: 0, remaining: 0)
        XCTAssertEqual(cycle.progress, 0)
    }

    func testEveryStageHasAnIcon() {
        for stage in LaundryStage.allCases {
            XCTAssertFalse(stage.systemImage.isEmpty)
        }
    }

    func testWasherTimeString() {
        let view = WasherTimerView()
        XCTAssertEqual(view.timeString(time: 2700), "45:00")
        XCTAssertEqual(view.timeString(time: 65), "01:05")
        XCTAssertEqual(view.timeString(time: 0), "00:00")
    }

    @MainActor
    func testStatusViewModelFormatsTime() {
        let viewModel = LaundryStatusViewModel()
        viewModel.cycle = LaundryCycle(machineName: "Dryer 1", stage: .drying, totalDuration: 600, remaining: 125)
        XCTAssertEqual(viewModel.formattedTime, "02:05")

        viewModel.cycle = nil
        XCTAssertEqual(viewModel.formattedTime, "--:--")
    }
}
