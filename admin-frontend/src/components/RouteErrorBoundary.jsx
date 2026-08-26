import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component } from 'react';

export default class RouteErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Falha ao renderizar rota administrativa:', error, info);
  }

  retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-red-400/20 bg-[#161B27] px-6 py-12 text-center">
        <div className="max-w-md">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-400/10 text-red-300">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-base font-semibold text-white">Não foi possível montar esta tela</h1>
          <p className="mt-2 text-sm leading-6 text-[#94A3B8]">O painel encontrou uma falha ao renderizar este módulo. Nenhum dado foi alterado. Tente novamente ou verifique os logs administrativos.</p>
          <button type="button" onClick={this.retry} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"><RefreshCw className="h-4 w-4" />Tentar novamente</button>
        </div>
      </div>
    );
  }
}
