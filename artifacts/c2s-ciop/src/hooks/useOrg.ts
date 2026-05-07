import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

export function useOrg() {
  const { data, isLoading } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/orgs/me"), { credentials: "include" });
      return res.json();
    },
    staleTime: 60000,
  });
  return { org: data?.org ?? null, orgId: data?.org?.id ?? null, isLoading };
}
