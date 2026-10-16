#
#  washer_timer.py
#  DormWash
#
#  Python port of WasherTimerView.swift. Everything in one file: the washer
#  screen, the "Report a Problem" form, and the maintenance request logic.
#
#  The UI uses tkinter (ships with Python). The logic section has no UI
#  dependencies, so it can be imported and tested on its own.
#
#  Run:  python3 washer_timer.py           -> washer screen
#        python3 washer_timer.py --report  -> report form only
#

from __future__ import annotations

import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional


# MARK: - ===== Maintenance Request Logic =====

# MARK: - What can go wrong with a machine

class IssueType(Enum):
    WONT_START = "Won't start"
    LEAKING = "Leaking"
    WONT_DRAIN = "Won't drain"
    DOOR_STUCK = "Door stuck"
    OTHER = "Other"

    @property
    def id(self) -> str:
        return self.value


# MARK: - One maintenance request

@dataclass
class MaintenanceRequest:
    machine_id: str                # e.g. "W4" for Washer #4
    issue: IssueType
    details: str                   # what the student typed
    created_at: datetime = field(default_factory=datetime.now)
    id: uuid.UUID = field(default_factory=uuid.uuid4)


# MARK: - Why a request can be rejected

class RequestError(Enum):
    EMPTY_MACHINE_ID = "emptyMachineID"
    MACHINE_ID_TOO_LONG = "machineIDTooLong"
    MISSING_DETAILS = "missingDetails"     # "Other" needs an explanation
    DETAILS_TOO_LONG = "detailsTooLong"

    @property
    def message(self) -> str:
        return {
            RequestError.EMPTY_MACHINE_ID: "Please enter the machine number.",
            RequestError.MACHINE_ID_TOO_LONG: "Machine number is too long.",
            RequestError.MISSING_DETAILS: "Please describe the problem.",
            RequestError.DETAILS_TOO_LONG: "Description is too long.",
        }[self]


# MARK: - Rules

class RequestRules:
    MAX_MACHINE_ID_LENGTH = 10
    MAX_DETAILS_LENGTH = 500


def validate(request: MaintenanceRequest) -> Optional[RequestError]:
    """Checks a request. Returns None if it is OK, or the first problem found."""
    machine_id = request.machine_id.strip()
    details = request.details.strip()

    if not machine_id:
        return RequestError.EMPTY_MACHINE_ID
    if len(machine_id) > RequestRules.MAX_MACHINE_ID_LENGTH:
        return RequestError.MACHINE_ID_TOO_LONG
    if request.issue == IssueType.OTHER and not details:
        return RequestError.MISSING_DETAILS
    if len(details) > RequestRules.MAX_DETAILS_LENGTH:
        return RequestError.DETAILS_TOO_LONG
    return None


# MARK: - Sending (mocked: no real network yet)

class MaintenanceService:
    def __init__(self) -> None:
        # Requests that went to the maintenance team.
        self._sent: List[MaintenanceRequest] = []
        # Requests that went to the developer test inbox (to_dev=True).
        self._sent_to_dev: List[MaintenanceRequest] = []

    @property
    def sent(self) -> List[MaintenanceRequest]:
        return list(self._sent)

    @property
    def sent_to_dev(self) -> List[MaintenanceRequest]:
        return list(self._sent_to_dev)

    def send_request(self, request: MaintenanceRequest, to_dev: bool = False) -> bool:
        """Sends a request. Returns True if it was valid and "sent".
        Later you can swap the body for a real network call."""
        problem = validate(request)
        if problem is not None:
            print(f"Not sent: {problem.message}")
            return False
        if to_dev:
            self._sent_to_dev.append(request)
        else:
            self._sent.append(request)
        return True


def send_request_alert(request_id: str, send_to_developer: bool = False) -> bool:
    """Quick check-and-send using just a request ID.
    Returns True if the ID has at least 1 character and the alert was "sent".
    send_to_developer=True sends it to the developer inbox instead of maintenance."""
    request = MaintenanceRequest(machine_id=request_id, issue=IssueType.WONT_START, details="")
    return MaintenanceService().send_request(request, to_dev=send_to_developer)


# Helper to format seconds into MM:SS
def time_string(time: int) -> str:
    minutes, seconds = divmod(time, 60)
    return f"{minutes:02d}:{seconds:02d}"


# MARK: - ===== Report a Problem Form =====

class ReportIssueView:
    def __init__(self, master, machine_id: str = "W4") -> None:
        import tkinter as tk
        from tkinter import ttk

        self.machine_id = machine_id
        self.service = MaintenanceService()   # one shared service for the screen

        self.window = tk.Toplevel(master)
        self.window.title("Report a Problem")
        self.window.resizable(False, False)
        self.window.transient(master)

        body = ttk.Frame(self.window, padding=20)
        body.pack(fill="both", expand=True)

        ttk.Label(body, text="Machine", font=("TkDefaultFont", 10, "bold")).pack(anchor="w")
        ttk.Label(body, text=f"Washer {machine_id}").pack(anchor="w", pady=(0, 12))

        ttk.Label(body, text="What's wrong?", font=("TkDefaultFont", 10, "bold")).pack(anchor="w")
        self.issue_var = tk.StringVar(value=IssueType.WONT_START.value)
        ttk.Combobox(
            body,
            textvariable=self.issue_var,
            values=[t.value for t in IssueType],
            state="readonly",
        ).pack(fill="x", pady=(0, 12))

        ttk.Label(body, text="Details", font=("TkDefaultFont", 10, "bold")).pack(anchor="w")
        self.details_text = tk.Text(body, width=40, height=5, wrap="word")
        self.details_text.pack(fill="x")
        self.count_label = ttk.Label(body, foreground="gray")
        self.count_label.pack(anchor="e", pady=(0, 12))
        self.details_text.bind("<<Modified>>", self._on_details_changed)
        self._update_count()

        ttk.Button(body, text="Send to Maintenance", command=self.submit).pack(fill="x")

    @property
    def details(self) -> str:
        return self.details_text.get("1.0", "end-1c")

    def _on_details_changed(self, _event=None) -> None:
        self._update_count()
        self.details_text.edit_modified(False)

    def _update_count(self) -> None:
        self.count_label.config(text=f"{len(self.details)}/{RequestRules.MAX_DETAILS_LENGTH}")

    def submit(self) -> None:
        from tkinter import messagebox

        request = MaintenanceRequest(
            machine_id=self.machine_id,
            issue=IssueType(self.issue_var.get()),
            details=self.details,
        )

        problem = validate(request)
        if problem is not None:
            messagebox.showwarning("Report a Problem", problem.message, parent=self.window)
            return

        self.service.send_request(request)
        self.details_text.delete("1.0", "end")
        messagebox.showinfo("Report a Problem", "Thanks! Maintenance has been notified.",
                            parent=self.window)
        self.window.destroy()   # close the form after a successful send


# MARK: - ===== Washer Screen =====

class WasherTimerView:
    SPIN_FRAME_MS = 25          # 1.5 s per full rotation, like the SwiftUI animation

    def __init__(self, master) -> None:
        import tkinter as tk
        from tkinter import ttk

        self.master = master
        master.title("DormWash")

        # Standard timer state
        self.time_remaining = 2700  # 45 minutes in seconds
        self.is_spinning = False
        self._spin_angle = 0.0

        # AI Feature State
        self.ai_prediction_active = tk.BooleanVar(value=False)
        self.ai_prediction_active.trace_add("write", lambda *_: self._refresh_time())

        root = ttk.Frame(master, padding=30)
        root.pack(fill="both", expand=True)

        ttk.Label(root, text="Washer #1 Status", font=("TkDefaultFont", 18, "bold")).pack(pady=(0, 30))

        # 1. The Washer Design
        self.canvas = tk.Canvas(root, width=300, height=300, highlightthickness=0)
        self.canvas.pack()
        # Machine Body
        self._rounded_rect(10, 10, 290, 290, 30, fill="#e9e9ee", outline="")
        # Outer Door Ring
        self.canvas.create_oval(50, 50, 250, 250, outline="#f08080", width=15)
        # Inner Glass
        self.canvas.create_oval(55, 55, 245, 245, fill="#d6d6db", outline="")
        # 2. Animated Water Indicator (60% of a circle)
        self.water_arc = self.canvas.create_arc(
            70, 70, 230, 230, start=90, extent=-216,
            style="arc", outline="white", width=12,
        )
        # Timer Display inside the drum
        self.time_text = self.canvas.create_text(
            150, 145, font=("Courier", 34, "bold"), fill="black")
        self.ai_badge = self.canvas.create_text(
            150, 180, text="AI Adjusted ✨", font=("TkDefaultFont", 10, "bold"), fill="purple")

        # 3. AI Feature Toggle
        ai_box = tk.Frame(root, bg="#efe6f7", padx=15, pady=15)
        ai_box.pack(fill="x", pady=30)
        tk.Checkbutton(
            ai_box, text="✨ Smart Cycle Prediction", variable=self.ai_prediction_active,
            bg="#efe6f7", activebackground="#efe6f7", font=("TkDefaultFont", 12, "bold"),
        ).pack(anchor="w")
        tk.Label(
            ai_box,
            text="Uses local CoreML data to adjust the timer based on historical "
                 "cycle delays for this specific machine model.",
            bg="#efe6f7", fg="gray30", wraplength=300, justify="left",
        ).pack(anchor="w")

        # 4. Report a broken machine
        tk.Button(
            root, text="⚠ Report a Problem", command=self.show_report_form,
            bg="#d9363e", fg="white", activebackground="#b52a31", activeforeground="white",
            font=("TkDefaultFont", 12, "bold"), relief="flat", pady=8,
        ).pack(fill="x")

        self._refresh_time()

        # Start the spinning animation when the view loads
        self.is_spinning = True
        self._spin()

    # The AI adjusts the timer based on "historical dorm load data" (mocked logic)
    @property
    def display_time(self) -> int:
        # Example: AI predicts this specific machine takes 5 mins longer than the digital display says
        return self.time_remaining + 300 if self.ai_prediction_active.get() else self.time_remaining

    def show_report_form(self) -> None:
        ReportIssueView(self.master, machine_id="W4")

    def _refresh_time(self) -> None:
        self.canvas.itemconfig(self.time_text, text=time_string(self.display_time))
        self.canvas.itemconfig(
            self.ai_badge, state="normal" if self.ai_prediction_active.get() else "hidden")

    def _spin(self) -> None:
        if not self.is_spinning:
            return
        step = 360 / (1500 / self.SPIN_FRAME_MS)
        self._spin_angle = (self._spin_angle - step) % 360   # clockwise
        self.canvas.itemconfig(self.water_arc, start=90 + self._spin_angle)
        self.master.after(self.SPIN_FRAME_MS, self._spin)

    def _rounded_rect(self, x1, y1, x2, y2, r, **kwargs):
        points = [
            x1 + r, y1, x2 - r, y1, x2, y1, x2, y1 + r,
            x2, y2 - r, x2, y2, x2 - r, y2, x1 + r, y2,
            x1, y2, x1, y2 - r, x1, y1 + r, x1, y1,
        ]
        return self.canvas.create_polygon(points, smooth=True, **kwargs)


def main() -> None:
    import tkinter as tk

    root = tk.Tk()
    if "--report" in sys.argv:   # like the "Report Form" preview
        root.withdraw()
        form = ReportIssueView(root)
        form.window.protocol("WM_DELETE_WINDOW", root.destroy)
        form.window.bind("<Destroy>", lambda e: root.destroy() if e.widget is form.window else None)
    else:
        WasherTimerView(root)
    root.mainloop()


if __name__ == "__main__":
    main()
