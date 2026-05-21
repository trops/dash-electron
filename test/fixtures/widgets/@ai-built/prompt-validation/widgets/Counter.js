import React, { useState } from "react";
import {
    Panel,
    SubHeading2,
    Heading2,
    Button,
    Button2,
    Button3,
    Caption,
} from "@trops/dash-react";

export default function Counter({
    title = "Counter",
    initialValue = 0,
    step = 1,
}) {
    const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
    const safeInitial = Number.isFinite(initialValue) ? initialValue : 0;

    const [count, setCount] = useState(safeInitial);

    const increment = () => setCount((c) => c + safeStep);
    const decrement = () => setCount((c) => c - safeStep);
    const reset = () => setCount(safeInitial);

    return (
        <Panel>
            <div className="flex flex-col items-center justify-center gap-6 p-4">
                <SubHeading2 title={title} />

                <Heading2 title={String(count)} />

                <Caption text={`Step: ${safeStep}`} />

                <div className="flex flex-row items-center gap-3">
                    <Button2 title="−" onClick={decrement} size="sm" />
                    <Button title="+" onClick={increment} size="sm" />
                </div>

                <Button3 title="Reset" onClick={reset} size="sm" />
            </div>
        </Panel>
    );
}
