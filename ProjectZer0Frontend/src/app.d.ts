declare global {
	namespace App {
	  interface PageData {
		view: import('$lib/types/graph').ViewType;
		viewType: import('$lib/types/graph').ViewType;
		wordData: any | null;
	  }
	}
  }
  
  export {};