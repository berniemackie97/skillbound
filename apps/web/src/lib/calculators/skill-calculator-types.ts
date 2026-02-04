import type { SkillName } from '@skillbound/domain';

export type CalculatorPayload<T> = {
  source: string;
  fetchedAt: string;
  payload: T;
};

export type CalculatorBonus = {
  name: string;
  bonus: number;
  validCategories: number[];
};

export type CalculatorItem = {
  name: string;
  amount?: number;
  price?: number | null;
  real_time_price?: number | null;
};

export type SkillAction = {
  name: string;
  image?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  action_members: boolean;
  level_req: number;
  exp_given: number;
  categories: number[];
  link?: string | null;
  components?: CalculatorItem[] | null;
  products?: CalculatorItem[] | null;
};

export type SkillCalculatorData = {
  name: string;
  slug: string;
  members_only: boolean;
  bonuses: CalculatorBonus[];
  categories: Record<string, string> | [];
  profit_loss_settings: {
    enabled: boolean;
    show_components: boolean;
    real_time_prices: boolean;
  };
  data: SkillAction[];
};

export type CombatMonster = {
  name: string;
  level: number;
  hitpoints: number;
  members: boolean;
  xp_bonus_multiplier?: number;
};

export type CombatTrainingData = {
  categories: Record<string, string> | [];
  data: CombatMonster[];
};

export type CalculatorDataResponse =
  | {
      type: 'skill';
      skill: SkillName;
      source: string;
      fetchedAt: string;
      data: SkillCalculatorData;
    }
  | {
      type: 'combat';
      skill: SkillName;
      source: string;
      fetchedAt: string;
      data: CombatTrainingData;
    };
