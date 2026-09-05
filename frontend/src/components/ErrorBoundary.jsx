import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-5 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl m-4 h-full flex flex-col items-start gap-4">
          <div>
            <h2 className="font-bold mb-2">Erro ao renderizar o componente:</h2>
            <pre className="text-xs overflow-auto max-w-full">{this.state.error?.toString()}</pre>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            Voltar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
