import { useQuery } from "@tanstack/react-query";
import { userService } from "../services/userService";
import type { User } from "../types/family";

export const useUserList = () => {
  return useQuery<User[], string>({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await userService.getUsers(true);
      if (error) throw new Error(error);
      return data || [];
    },
  });
};
