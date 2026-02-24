import React from "react";
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        //   logErrorToMyService(error, errorInfo);
        console.log(error);
        this.setState({
            hasError: true,
            error: error.message,
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col h-full w-full p-10 justify-center items-center">
                    <span className="text-4xl text-gray-700 font-bold">
                        This is embarrassing.
                    </span>
                    <span className="text-lg text-gray-700 font-bold">
                        {this.state.error}
                    </span>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
