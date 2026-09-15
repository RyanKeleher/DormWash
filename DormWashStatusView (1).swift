// xcode: set sdk=iOS

//
//  DormWashStatusView.swift
//  Dorm Wash
//
//  Clean, minimal main screen showing the user's active laundry
//  cycle and a live countdown timer.
//

import SwiftUI
import Combine

// MARK: - Model

enum LaundryStage: String, CaseIterable {
    case washing = "Washing"
    case drying = "Drying"
    case done = "Done"

    var systemImage: String {
        switch self {
        case .washing: return "washer.fill"
        case .drying: return "dryer.fill"
        case .done: return "checkmark.circle.fill"
        }
    }
}

struct LaundryCycle {
    var machineName: String
    var stage: LaundryStage
    var totalDuration: TimeInterval
    var remaining: TimeInterval

    var progress: Double {
        guard totalDuration > 0 else { return 0 }
        return 1 - (remaining / totalDuration)
    }
}

// MARK: - View Model

@MainActor
final class LaundryStatusViewModel: ObservableObject {
    @Published var cycle: LaundryCycle?
    @Published var hasActiveCycle: Bool = true

    private var countdownTask: Task<Void, Never>?

    init() {
        // Sample data — replace with real machine/session data.
        cycle = LaundryCycle(
            machineName: "Washer 3B",
            stage: .washing,
            totalDuration: 45 * 60,
            remaining: 27 * 60 + 15
        )
        startCountdown()
    }

    /// Swift 6-safe countdown loop. Since this class is @MainActor,
    /// the whole Task body runs on the main actor with no cross-actor
    /// self capture, avoiding the "captured var 'self'" concurrency error.
    func startCountdown() {
        countdownTask?.cancel()
        countdownTask = Task { [weak self] in
            while let self, !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if Task.isCancelled { return }
                self.tick()
            }
        }
    }

    private func tick() {
        guard var current = cycle, current.remaining > 0 else {
            if cycle != nil {
                cycle?.stage = .done
                cycle?.remaining = 0
            }
            countdownTask?.cancel()
            return
        }
        current.remaining -= 1
        cycle = current
    }

    var formattedTime: String {
        guard let remaining = cycle?.remaining else { return "--:--" }
        let minutes = Int(remaining) / 60
        let seconds = Int(remaining) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    deinit {
        countdownTask?.cancel()
    }
}

// MARK: - Main Screen

struct DormWashStatusView: View {
    @StateObject private var viewModel = LaundryStatusViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    header

                    if let cycle = viewModel.cycle {
                        statusCard(for: cycle)
                        actionButtons(for: cycle)
                    } else {
                        emptyState
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 16)
                .padding(.bottom, 40)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Dorm Wash")
            .navigationBarTitleDisplayMode(.large)
        }
    }

    // MARK: Header

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Hey there 👋")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text("Here's your laundry")
                    .font(.title2.weight(.semibold))
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Status Card

    private func statusCard(for cycle: LaundryCycle) -> some View {
        VStack(spacing: 24) {
            ZStack {
                Circle()
                    .stroke(Color(.systemGray5), lineWidth: 12)

                Circle()
                    .trim(from: 0, to: cycle.progress)
                    .stroke(
                        cycle.stage == .done ? Color.green : Color.accentColor,
                        style: StrokeStyle(lineWidth: 12, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(.easeInOut(duration: 0.5), value: cycle.progress)

                VStack(spacing: 6) {
                    Image(systemName: cycle.stage.systemImage)
                        .font(.title)
                        .foregroundStyle(cycle.stage == .done ? .green : .accentColor)
                    Text(viewModel.formattedTime)
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .monospacedDigit()
                    Text(cycle.stage.rawValue)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 200, height: 200)

            VStack(spacing: 4) {
                Text(cycle.machineName)
                    .font(.headline)
                Text(cycle.stage == .done ? "Ready to pick up" : "In progress")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }

    // MARK: Actions

    private func actionButtons(for cycle: LaundryCycle) -> some View {
        VStack(spacing: 12) {
            if cycle.stage == .done {
                Button {
                    // Mark as collected
                } label: {
                    Label("Mark as Collected", systemImage: "checkmark")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
            } else {
                Button {
                    // Notify when done — e.g. schedule a local notification
                } label: {
                    Label("Notify Me When Done", systemImage: "bell")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)

                Button(role: .destructive) {
                    // Cancel / release machine
                } label: {
                    Text("Cancel Cycle")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.bordered)
            }
        }
    }

    // MARK: Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "washer")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("No active laundry")
                .font(.headline)
            Text("Reserve a machine to get started.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button {
                // Navigate to machine booking screen
            } label: {
                Label("Find a Machine", systemImage: "plus")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 8)
        }
        .padding(40)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }
}

// MARK: - Preview

#Preview {
    DormWashStatusView()
}
