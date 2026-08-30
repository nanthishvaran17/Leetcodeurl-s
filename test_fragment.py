import asyncio
import httpx

async def test():
    query = """
    fragment ProfileFields on MatchedUser {
        username
        profile { ranking }
    }
    query {
      u0: matchedUser(username: "nanthishvaran_07") { ...ProfileFields }
    }
    """
    async with httpx.AsyncClient() as client:
        r = await client.post("https://leetcode.com/graphql", json={"query": query})
        print(r.text)

asyncio.run(test())
