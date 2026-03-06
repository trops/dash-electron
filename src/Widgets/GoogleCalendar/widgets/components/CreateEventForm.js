import { useState } from "react";

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function defaultStartTime() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    return now.toTimeString().slice(0, 5);
}

function defaultEndTime() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 2);
    return now.toTimeString().slice(0, 5);
}

export function CreateEventForm({ onSubmit, loading }) {
    const [title, setTitle] = useState("");
    const [date, setDate] = useState(todayStr());
    const [startTime, setStartTime] = useState(defaultStartTime());
    const [endTime, setEndTime] = useState(defaultEndTime());
    const [description, setDescription] = useState("");
    const [result, setResult] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !date || !startTime || !endTime) return;
        setResult(null);

        const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
        const endDateTime = new Date(`${date}T${endTime}:00`).toISOString();

        const args = {
            summary: title.trim(),
            start: startDateTime,
            end: endDateTime,
        };
        if (description.trim()) args.description = description.trim();

        const success = await onSubmit(args);
        if (success) {
            setResult("success");
            setTitle("");
            setDescription("");
        } else {
            setResult("error");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-2">
            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title"
                required
                className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-2">
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                />
            </div>
            <div className="flex gap-2">
                <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                />
                <span className="text-gray-500 text-xs self-center">to</span>
                <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                />
            </div>
            <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            />
            <button
                type="submit"
                disabled={loading || !title.trim()}
                className="w-full px-3 py-1.5 text-xs rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
            >
                {loading ? "Creating..." : "Create Event"}
            </button>

            {result === "success" && (
                <div className="p-2 bg-green-900/30 border border-green-700 rounded text-green-300 text-xs">
                    Event created successfully
                </div>
            )}
            {result === "error" && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    Failed to create event
                </div>
            )}
        </form>
    );
}
