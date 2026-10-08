
import KFLHero from './KFLHero';
import KFLTournaments from '../components/KFLTournaments';
import KFLAthletes from '../components/KFLAthletes';

export default function Home() {
  return (
    <main className="kfl-home-page">
      <KFLHero />
      <KFLTournaments />
      <KFLAthletes />
    </main>
  );
}
