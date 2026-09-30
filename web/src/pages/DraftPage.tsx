import { DraftBoard } from '../components/draft/DraftBoard';
import { Footer } from '../components/Footer';
import { ToolGuide } from '../components/ToolGuide';

export function DraftPage() {
  return <><main className="container mx-auto px-4 py-5 sm:px-6 sm:py-7 lg:px-8"><DraftBoard /><ToolGuide path="/draft" className="mt-6" /></main><Footer /></>;
}
