import DayExperience from "../../components/DayExperience";
import { notesFor } from "../../components/notes";
export default function Home() { return <DayExperience locale="en" notes={notesFor("en")} />; }
