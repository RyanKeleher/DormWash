// xcode: set sdk=iOS

//
//  WasherTimerView.swift
//  DormWash
//
//  Everything in one file: the washer screen, the "Report a Problem"
//  form, and the maintenance request logic.
//

import Foundation
import SwiftUI

// MARK: - ===== Washer Screen =====

struct WasherTimerView: View {
    // Standard timer state
    @State private var timeRemaining = 2700 // 45 minutes in seconds
    @State private var isSpinning = false
    
    // AI Feature State
    @State private var aiPredictionActive = false

    // Maintenance: controls whether the "Report a Problem" form is showing
    @State private var showReportForm = false

    // The AI adjusts the timer based on "historical dorm load data" (mocked logic)
    var displayTime: Int {
        // Example: AI predicts this specific machine takes 5 mins longer than the digital display says
        aiPredictionActive ? timeRemaining + 300 : timeRemaining
    }

    var body: some View {
        VStack(spacing: 40) {
            
            Text("Washer #1 Status")
                .font(.title2)
                .bold()

            // 1. The Washer Design
            ZStack {
                // Machine Body
                RoundedRectangle(cornerRadius: 30)
                    .fill(Color(UIColor.secondarySystemBackground))
                    .frame(width: 280, height: 280)
                    .shadow(radius: 5)

                // Outer Door Ring
                Circle()
                    .stroke(Color.red.opacity(0.5), lineWidth: 15)
                    .frame(width: 200, height: 200)
                
                // Inner Glass
                Circle()
                    .fill(Color.black.opacity(0.1))
                    .frame(width: 190, height: 190)

                // 2. Animated Water Indicator
                Circle()
                    .trim(from: 0.0, to: 0.6)
                    .stroke(Color.white.opacity(0.7), style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .frame(width: 160, height: 160)
                    .rotationEffect(.degrees(isSpinning ? 360 : 0))
                    .animation(isSpinning ? Animation.linear(duration: 1.5).repeatForever(autoreverses: false) : .default, value: isSpinning)

                // Timer Display inside the drum
                VStack {
                    Text(timeString(time: displayTime))
                        .font(.system(size: 42, weight: .bold, design: .monospaced))
                    
                    if aiPredictionActive {
                        Text("AI Adjusted ✨")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.purple)
                    }
                }
            }

            // 3. AI Feature Toggle
            VStack(alignment: .leading, spacing: 10) {
                Toggle(isOn: $aiPredictionActive) {
                    Label("Smart Cycle Prediction", systemImage: "sparkles")
                        .font(.headline)
                }
                .tint(.green)
                
                Text("Uses local CoreML data to adjust the timer based on historical cycle delays for this specific machine model.")
                    .font(.footnote)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding()
            .background(Color.purple.opacity(0.1))
            .cornerRadius(15)
            .padding(.horizontal, 30)

            // 4. Report a broken machine
            Button {
                showReportForm = true
            } label: {
                Label("Report a Problem", systemImage: "exclamationmark.triangle.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)
            .padding(.horizontal, 30)

        }
        // Slides the report form up from the bottom when the button is tapped
        .sheet(isPresented: $showReportForm) {
            ReportIssueView(machineID: "W4")
        }
        .onAppear {
            // Start the spinning animation when the view loads
            isSpinning = true
        }
    }

    // Helper to format seconds into MM:SS
    func timeString(time: Int) -> String {
        let minutes = time / 60
        let seconds = time % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
}

// MARK: - ===== Report a Problem Form =====

struct ReportIssueView: View {
    // Pass in the machine they were looking at, e.g. "W4"
    var machineID: String = "W4"

    @State private var issue: IssueType = .wontStart
    @State private var details = ""
    @State private var alertMessage: String?
    @State private var didSend = false

    // Lets this screen close itself
    @Environment(\.dismiss) private var dismiss

    // One shared service for the screen
    @State private var service = MaintenanceService()

    var body: some View {
        NavigationStack {
            Form {
                Section("Machine") {
                    Text("Washer \(machineID)")
                }

                Section("What's wrong?") {
                    Picker("Issue", selection: $issue) {
                        ForEach(IssueType.allCases) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }
                }

                Section("Details") {
                    TextField("Describe the problem (optional)", text: $details, axis: .vertical)
                        .lineLimit(3...6)
                    Text("\(details.count)/\(RequestRules.maxDetailsLength)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Button("Send to Maintenance") {
                    submit()
                }
                .frame(maxWidth: .infinity)
            }
            .navigationTitle("Report a Problem")
            .alert(alertMessage ?? "", isPresented: Binding(
                get: { alertMessage != nil },
                set: { if !$0 { alertMessage = nil } }
            )) {
                Button("OK", role: .cancel) {
                    if didSend { dismiss() }   // close the form after a successful send
                }
            }
        }
    }

    private func submit() {
        let request = MaintenanceRequest(machineID: machineID, issue: issue, details: details)

        if let problem = validate(request) {
            alertMessage = problem.message
            return
        }

        service.sendRequest(request)
        didSend = true
        alertMessage = "Thanks! Maintenance has been notified."
        details = ""
    }
}

// MARK: - ===== Maintenance Request Logic =====

// MARK: - What can go wrong with a machine

enum IssueType: String, CaseIterable, Identifiable {
    case wontStart  = "Won't start"
    case leaking    = "Leaking"
    case wontDrain  = "Won't drain"
    case doorStuck  = "Door stuck"
    case other      = "Other"

    var id: String { rawValue }
}

// MARK: - One maintenance request

struct MaintenanceRequest: Identifiable {
    let id = UUID()
    var machineID: String          // e.g. "W4" for Washer #4
    var issue: IssueType
    var details: String            // what the student typed
    var createdAt: Date = Date()
}

// MARK: - Why a request can be rejected

enum RequestError: Error, Equatable {
    case emptyMachineID
    case machineIDTooLong
    case missingDetails            // "Other" needs an explanation
    case detailsTooLong

    var message: String {
        switch self {
        case .emptyMachineID:   return "Please enter the machine number."
        case .machineIDTooLong: return "Machine number is too long."
        case .missingDetails:   return "Please describe the problem."
        case .detailsTooLong:   return "Description is too long."
        }
    }
}

// MARK: - Rules

enum RequestRules {
    static let maxMachineIDLength = 10
    static let maxDetailsLength = 500
}

/// Checks a request. Returns nil if it is OK, or the first problem found.
func validate(_ request: MaintenanceRequest) -> RequestError? {
    let id = request.machineID.trimmingCharacters(in: .whitespacesAndNewlines)
    let details = request.details.trimmingCharacters(in: .whitespacesAndNewlines)

    if id.isEmpty { return .emptyMachineID }
    if id.count > RequestRules.maxMachineIDLength { return .machineIDTooLong }
    if request.issue == .other && details.isEmpty { return .missingDetails }
    if details.count > RequestRules.maxDetailsLength { return .detailsTooLong }
    return nil
}

// MARK: - Sending (mocked: no real network yet)

final class MaintenanceService {
    /// Requests that went to the maintenance team.
    private(set) var sent: [MaintenanceRequest] = []
    /// Requests that went to the developer test inbox (toDev: true).
    private(set) var sentToDev: [MaintenanceRequest] = []

    /// Sends a request. Returns true if it was valid and "sent".
    /// Later you can swap the body for a real network call.
    @discardableResult
    func sendRequest(_ request: MaintenanceRequest, toDev: Bool = false) -> Bool {
        if let problem = validate(request) {
            print("Not sent: \(problem.message)")
            return false
        }
        if toDev {
            sentToDev.append(request)
        } else {
            sent.append(request)
        }
        return true
    }
}

/// Quick check-and-send using just a request ID.
/// Returns true if the ID has at least 1 character and the alert was "sent".
/// sendToDeveloper: true sends it to the developer inbox instead of maintenance.
func sendRequestAlert(_ requestID: String, sendToDeveloper: Bool = false) -> Bool {
    let request = MaintenanceRequest(machineID: requestID, issue: .wontStart, details: "")
    return MaintenanceService().sendRequest(request, toDev: sendToDeveloper)
}

#Preview {
    WasherTimerView()
}

#Preview("Report Form") {
    ReportIssueView()
}
