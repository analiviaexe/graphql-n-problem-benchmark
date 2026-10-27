export function buildQueries(limit) {
  return {
    level1: {
      name: 'Nível 1 (Titles)',
      query: `
        query Level1 {
          getTitles(limit: ${limit}) {
            tconst
            primary_title
            start_year
          }
        }
      `,
    },
    level2: {
      name: 'Nível 2 (Titles -> Rating + Principals)',
      query: `
        query Level2 {
          getTitles(limit: ${limit}) {
            tconst
            primary_title
            start_year
            rating {
              average_rating
              num_votes
            }
            principals {
              ordering
              category
            }
          }
        }
      `,
    },
    level3: {
      name: 'Nível 3 (Titles -> Rating + Principals -> Name)',
      query: `
        query Level3 {
          getTitles(limit: ${limit}) {
            tconst
            primary_title
            start_year
            rating {
              average_rating
              num_votes
            }
            principals {
              ordering
              category
              name {
                primary_name
              }
            }
          }
        }
      `,
    },
    level4: {
      name: 'Nível 4 (Titles -> Rating + Principals -> Name -> KnownForTitles)',
      query: `
        query Level4 {
          getTitles(limit: ${limit}) {
            tconst
            primary_title
            start_year
            rating {
              average_rating
              num_votes
            }
            principals {
              ordering
              category
              name {
                primary_name
                known_for_titles {
                  tconst
                  primary_title
                }
              }
            }
          }
        }
      `,
    },
  };
}
