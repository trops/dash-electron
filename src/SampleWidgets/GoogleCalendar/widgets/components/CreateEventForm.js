import { useState } from "react";
import {
    AlertBanner,
    Button,
    Caption2,
    InputText,
    TextArea,
} from "@trops/dash-react";

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
            <InputText
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title"
                required
                height="h-7"
                padding="px-2 py-1"
                inputClassName="text-xs"
            />
            <div className="flex flex-wrap gap-2">
                <InputText
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="flex-1 min-w-0"
                    height="h-7"
                    padding="px-2 py-1"
                    inputClassName="text-xs"
                />
            </div>
            <div className="flex flex-wrap gap-2">
                <InputText
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="flex-1 min-w-0"
                    height="h-7"
                    padding="px-2 py-1"
                    inputClassName="text-xs"
                />
                <Caption2 className="self-center">to</Caption2>
                <InputText
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="flex-1 min-w-0"
                    height="h-7"
                    padding="px-2 py-1"
                    inputClassName="text-xs"
                />
            </div>
            <TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                padding="px-2 py-1"
                inputClassName="text-xs resize-none"
            />
            <Button
                type="submit"
                size="sm"
                block
                disabled={loading || !title.trim()}
            >
                {loading ? "Creating..." : "Create Event"}
            </Button>

            {result === "success" && (
                <AlertBanner
                    variant="success"
                    size="compact"
                    message="Event created successfully"
                />
            )}
            {result === "error" && (
                <AlertBanner
                    variant="error"
                    size="compact"
                    message="Failed to create event"
                />
            )}
        </form>
    );
}
