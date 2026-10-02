import type { Metadata } from "next"
import { TodoApp } from "@/components/tools/todo/todo-app"

export const metadata: Metadata = {
  title: "Tasks",
  description: "To-dos with priorities, due dates, subtasks and repeating tasks — saved in your browser.",
}

export default function TodoPage() {
  return <TodoApp />
}
