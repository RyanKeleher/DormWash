// xcode: set sdk=iOS

//
//  DormWash.swift
//  Files.xcfilescontainer
//
//  Created by Jace Haskins on 9/10/26.
//

import Foundation
import SwiftUI

struct WasherTimerView: View {
    // Standard timer state
    @State private var timeRemaining = 2700 // 45 minutes in seconds
    @State private var isSpinning = false
    
    // AI Feature State
    @State private var aiPredictionActive = false

    // The AI adjusts the timer based on "historical dorm load data" (mocked logic)
    var displayTime: Int {
        // Example: AI predicts this specific machine takes 5 mins longer than the digital display says
        aiPredictionActive ? timeRemaining + 300 : timeRemaining
    }

    var body: some View {
        VStack(spacing: 40) {
            
            Text("Washer #4 Status")
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
                    .stroke(Color.black.opacity(0.5), lineWidth: 15)
                    .frame(width: 200, height: 200)
                
                // Inner Glass
                Circle()
                    .fill(Color.blue.opacity(0.1))
                    .frame(width: 190, height: 190)

                // 2. Animated Water Indicator
                Circle()
                    .trim(from: 0.0, to: 0.6)
                    .stroke(Color.blue.opacity(0.7), style: StrokeStyle(lineWidth: 12, lineCap: .round))
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
                .tint(.purple)
                
                Text("Uses local CoreML data to adjust the timer based on historical cycle delays for this specific machine model.")
                    .font(.footnote)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding()
            .background(Color.purple.opacity(0.1))
            .cornerRadius(15)
            .padding(.horizontal, 30)

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

#Preview {
    WasherTimerView()
}
