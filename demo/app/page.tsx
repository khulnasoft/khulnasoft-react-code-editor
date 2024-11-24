"use client"
import styles from './page.module.css'
import { KhulnasoftEditor } from "@khulnasoft/react-code-editor";

export default function Home() {
  return (
    <main className={styles.main}>
      <KhulnasoftEditor language="python" />
    </main>
  )
}
