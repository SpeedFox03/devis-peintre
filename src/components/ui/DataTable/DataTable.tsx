import type { ReactNode } from "react";
import "./DataTable.css";

type DataTableProps = {
  headers: ReactNode;
  children: ReactNode;
};

export function DataTable({ headers, children }: DataTableProps) {
  return (
    <table className="ui-data-table">
      <thead>{headers}</thead>
      <tbody>{children}</tbody>
    </table>
  );
}