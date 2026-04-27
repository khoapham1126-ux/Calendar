let conflictAppointmentId = null;
let pendingAppointment = null;
let pendingReminder = null;
let currentJoinAppointmentId = null;

document.addEventListener("DOMContentLoaded", () => {
    loadAppointments();

    const btnJoin = document.getElementById("btnJoinGroup");
    if (btnJoin) {
        btnJoin.addEventListener("click", () => {
            currentJoinAppointmentId = conflictAppointmentId;
            bootstrap.Modal.getInstance(document.getElementById("conflictModal"))?.hide();
            new bootstrap.Modal(document.getElementById("joinModal")).show();
        });
    }

    const btnReplace = document.getElementById("btnReplace");
    if (btnReplace) {
        btnReplace.addEventListener("click", replaceAppointment);
    }

    const conflictModalEl = document.getElementById("conflictModal");
    if (conflictModalEl) {
        conflictModalEl.addEventListener("hidden.bs.modal", () => {
            resetModalState();
        });
    }

    const joinModalEl = document.getElementById("joinModal");
    if (joinModalEl) {
        joinModalEl.addEventListener("hidden.bs.modal", () => {
            const participantName = document.getElementById("participantName");
            if (participantName) participantName.value = "";
        });
    }
});

async function createAppointment() {
    const model = {
        name: document.getElementById("name").value.trim(),
        location: document.getElementById("location").value.trim(),
        startTime: document.getElementById("startTime").value,
        endTime: document.getElementById("endTime").value,
        isGroupMeeting: document.getElementById("isGroupMeeting").checked
    };

    const reminderTime = document.getElementById("reminderTime").value;
    const reminderMessage = document.getElementById("reminderMessage").value.trim();

    if (!model.name) return showAlert("danger", "Tên lịch hẹn không được để trống");
    if (!model.startTime || !model.endTime) return showAlert("danger", "Vui lòng nhập đầy đủ giờ bắt đầu và kết thúc");
    if (new Date(model.startTime) >= new Date(model.endTime)) {
        return showAlert("danger", "Giờ bắt đầu phải nhỏ hơn giờ kết thúc");
    }

    if (reminderTime && new Date(reminderTime) >= new Date(model.startTime)) {
        return showAlert("danger", "Reminder time phải nhỏ hơn giờ bắt đầu");
    }

    pendingReminder = reminderTime
        ? {
            reminderTime: reminderTime,
            reminderMessage: reminderMessage
        }
        : null;

    try {
        const res = await fetch("/api/appointment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(model)
        });

        const data = await res.json();

        if (res.ok) {
            showAlert("success", data.message || "Tạo lịch hẹn thành công");

            if (reminderTime) {
                await addReminder(data.data.id, reminderTime, reminderMessage);
            }

            pendingReminder = null;
            resetForm();
            loadAppointments();
            return;
        }

        if (res.status === 409) {
            conflictAppointmentId = data.conflictId;
            pendingAppointment = model;
            showConflict(data.message, data.type);
            return;
        }

        showAlert("danger", data.message || "Có lỗi xảy ra");
    } catch (err) {
        console.error(err);
        showAlert("danger", "Không thể kết nối API");
    }
}

async function addReminder(appointmentId, reminderTime, reminderMessage) {
    try {
        await fetch(`/api/appointment/${appointmentId}/reminders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                reminderTime: reminderTime,
                message: reminderMessage
            })
        });
    } catch (err) {
        console.error(err);
    }
}

function showConflict(message, type) {
    const messageEl = document.getElementById("conflictMessage");
    if (messageEl) messageEl.textContent = message;

    const conflictHint = document.getElementById("conflictHint");
    const btnJoin = document.getElementById("btnJoinGroup");
    const btnReplace = document.getElementById("btnReplace");

    if (btnJoin) btnJoin.classList.add("d-none");
    if (btnReplace) btnReplace.classList.add("d-none");

    if (type === "group_meeting_conflict") {
        if (btnJoin) btnJoin.classList.remove("d-none");
        if (conflictHint) {
            conflictHint.textContent = "Bạn có thể join group meeting này nếu muốn tham gia thay vì tạo lịch mới.";
        }
    } else {
        if (btnReplace) btnReplace.classList.remove("d-none");
        if (conflictHint) {
            conflictHint.textContent = "Bạn có thể đổi sang thời gian khác hoặc thay thế lịch cũ bằng lịch mới này.";
        }
    }

    new bootstrap.Modal(document.getElementById("conflictModal")).show();
}

async function replaceAppointment() {
    if (!conflictAppointmentId || !pendingAppointment) return;

    try {
        const deleteRes = await fetch(`/api/appointment/${conflictAppointmentId}`, {
            method: "DELETE"
        });

        const deleteData = await deleteRes.json();
        if (!deleteRes.ok) {
            showAlert("danger", deleteData.message || "Không thể xóa lịch cũ");
            return;
        }

        const createRes = await fetch("/api/appointment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pendingAppointment)
        });

        const createData = await createRes.json();

        if (!createRes.ok) {
            showAlert("danger", createData.message || "Không thể tạo lịch mới sau khi thay thế");
            return;
        }

        if (pendingReminder && createData?.data?.id) {
            await addReminder(
                createData.data.id,
                pendingReminder.reminderTime,
                pendingReminder.reminderMessage
            );
        }

        bootstrap.Modal.getInstance(document.getElementById("conflictModal"))?.hide();
        showAlert("success", "Đã thay thế lịch cũ thành công");
        resetForm();
        loadAppointments();
    } catch (err) {
        console.error(err);
        showAlert("danger", "Không thể thay thế lịch");
    }
}

async function confirmJoinGroup() {
    const userName = document.getElementById("participantName").value.trim();
    if (!userName) {
        showAlert("danger", "Vui lòng nhập tên người tham gia");
        return;
    }

    try {
        const res = await fetch(`/api/appointment/${currentJoinAppointmentId}/join-group`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userName })
        });

        const data = await res.json();

        if (res.ok) {
            bootstrap.Modal.getInstance(document.getElementById("joinModal"))?.hide();
            showAlert("success", data.message || "Đã tham gia group meeting");
            loadAppointments();
        } else {
            showAlert("danger", data.message || "Không thể join group");
        }
    } catch (err) {
        console.error(err);
        showAlert("danger", "Lỗi khi join group");
    }
}

async function loadAppointments() {
    const listArea = document.getElementById("listArea");
    if (!listArea) return;

    try {
        const res = await fetch("/api/appointment");
        const data = await res.json();

        if (!data || data.length === 0) {
            listArea.innerHTML = `<div class="empty-state">Chưa có lịch hẹn nào. Hãy tạo lịch đầu tiên của bạn.</div>`;
            return;
        }

        listArea.innerHTML = `
            <div class="table-responsive">
                <table class="table align-middle">
                    <thead>
                        <tr>
                            <th>Tên</th>
                            <th>Địa điểm</th>
                            <th>Bắt đầu</th>
                            <th>Kết thúc</th>
                            <th>Loại</th>
                            <th>Reminder</th>
                            <th>Participants</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(item => `
                            <tr>
                                <td class="fw-semibold">${item.name || ""}</td>
                                <td>${item.location || "—"}</td>
                                <td>${formatDateTime(item.startTime)}</td>
                                <td>${formatDateTime(item.endTime)}</td>
                                <td>
                                    ${item.isGroupMeeting
                ? '<span class="badge text-bg-danger">Group</span>'
                : '<span class="badge text-bg-secondary">Cá nhân</span>'}
                                </td>
                                <td>
                                    ${item.reminders && item.reminders.length > 0
                ? `<span class="badge text-bg-success">${item.reminders.length} reminder</span>`
                : '<span class="badge text-bg-light text-dark">No reminder</span>'}
                                </td>
                                <td>
                                    ${item.participants && item.participants.length > 0
                ? `<span class="badge text-bg-primary">${item.participants.length} participant(s)</span>`
                : (item.isGroupMeeting ? '<span class="badge text-bg-light text-dark">0 participant</span>' : '—')}
                                </td>
                                <td>
                                    <button class="btn btn-sm btn-outline-danger" onclick="deleteAppointment(${item.id})">Xóa</button>
                                </td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        console.error(err);
        listArea.innerHTML = `<div class="empty-state text-danger">Không tải được danh sách lịch hẹn</div>`;
    }
}

async function deleteAppointment(id) {
    if (!confirm("Bạn có chắc muốn xóa lịch hẹn này?")) return;

    try {
        const res = await fetch(`/api/appointment/${id}`, { method: "DELETE" });
        const data = await res.json();

        if (res.ok) {
            showAlert("success", data.message || "Xóa thành công");
            loadAppointments();
        } else {
            showAlert("danger", data.message || "Không thể xóa");
        }
    } catch (err) {
        console.error(err);
        showAlert("danger", "Lỗi khi xóa lịch");
    }
}

function resetForm() {
    document.getElementById("name").value = "";
    document.getElementById("location").value = "";
    document.getElementById("startTime").value = "";
    document.getElementById("endTime").value = "";
    document.getElementById("isGroupMeeting").checked = false;
    document.getElementById("reminderTime").value = "";
    document.getElementById("reminderMessage").value = "";
}

function resetModalState() {
    const conflictMessage = document.getElementById("conflictMessage");
    if (conflictMessage) conflictMessage.textContent = "";

    const conflictHint = document.getElementById("conflictHint");
    if (conflictHint) conflictHint.textContent = "";

    const participantName = document.getElementById("participantName");
    if (participantName) participantName.value = "";

    conflictAppointmentId = null;
    pendingAppointment = null;
    pendingReminder = null;
    currentJoinAppointmentId = null;
}

function showAlert(type, msg) {
    const el = document.getElementById("formAlert");
    if (!el) return;

    el.className = `alert alert-${type}`;
    el.textContent = msg;
    el.classList.remove("d-none");

    setTimeout(() => {
        el.classList.add("d-none");
    }, 4000);
}

function formatDateTime(value) {
    if (!value) return "—";
    return new Date(value).toLocaleString("vi-VN");
}