import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtInt, fmtPct, fmtUsd } from "@/lib/format";
import type { ProductRow } from "@/lib/db";

interface Props {
  rows: ProductRow[];
  /** The conversion-state cohort the share column reports. */
  seriesLabel: string;
}

export function ProductTable({ rows, seriesLabel }: Props) {
  return (
    <Card
      className="gap-0 overflow-hidden py-0"
      data-testid="product-breakdown"
      data-utrace-target="conversion_product_table"
    >
      <CardHeader className="flex flex-row items-center justify-between border-b py-3">
        <CardTitle>Products</CardTitle>
        <span className="text-xs text-muted-foreground">{rows.length} rows</span>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0 [&:last-child]:pb-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-3 py-2 text-right font-medium">Sessions</th>
              <th className="px-3 py-2 text-right font-medium">Purchases</th>
              <th className="px-3 py-2 text-right font-medium">Conv. rate</th>
              <th className="px-3 py-2 text-right font-medium">{seriesLabel}</th>
              <th className="py-2 pl-3 pr-4 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No data for the current filters
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.productId}
                  data-testid={`product-row-${row.productId}`}
                  data-utrace-entity={`dudulemon_product:${row.productId}`}
                  data-utrace-visual-target="conversion_product_row"
                  data-utrace-safe-value="safe.control_label"
                  aria-label={`${row.productName} row`}
                  className="border-b transition-colors last:border-b-0 hover:bg-muted"
                >
                  <td className="px-4 py-2 font-medium">{row.productName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(row.sessions)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(row.purchases)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtPct(row.conversionRate)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPct(row.stateShare)}</td>
                  <td className="py-2 pl-3 pr-4 text-right tabular-nums">
                    {fmtUsd(row.revenueCents)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
